from fastapi import APIRouter, Request, Depends
from fastapi.responses import RedirectResponse, JSONResponse
from services.backend.app.config import settings
from services.backend.app.auth.google_client import make_flow, exchange_code_for_credentials, get_userinfo, SCOPES
from services.backend.app.auth.session import (
    create_state_token,
    verify_state_token,
    create_session_token,
    get_current_user_id,
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE,
)
from services.backend.app.db import SessionLocal
from services.backend.app import models
from services.backend.app.auth.crypto import encrypt

router = APIRouter()


@router.get("/start")
def oauth_start():
    flow = make_flow(scopes=SCOPES)
    state_token = create_state_token()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state_token,
    )
    return RedirectResponse(auth_url)


@router.get("/callback")
def oauth_callback(request: Request, code: str | None = None, state: str | None = None, error: str | None = None):
    if error:
        return JSONResponse({"error": error}, status_code=400)

    if not code:
        return JSONResponse({"error": "missing code"}, status_code=400)

    if not verify_state_token(state):
        return JSONResponse({"error": "invalid or expired state"}, status_code=400)

    creds = exchange_code_for_credentials(code)
    if creds is None:
        return JSONResponse({"error": "token exchange failed"}, status_code=500)

    userinfo = get_userinfo(creds)
    if not userinfo or "email" not in userinfo:
        return JSONResponse({"error": "failed to fetch userinfo"}, status_code=500)

    email = userinfo["email"]

    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == email).one_or_none()
        if user is None:
            user = models.User(email=email)
            db.add(user)
            db.flush()

        # persist refresh token if available (encrypt before storing)
        if creds.refresh_token:
            token = db.query(models.Token).filter(models.Token.user_id == user.id).one_or_none()
            enc = encrypt(creds.refresh_token)
            if token is None:
                token = models.Token(user_id=user.id, refresh_token=enc, scope=str(creds.scopes))
                db.add(token)
            else:
                token.refresh_token = enc
                token.scope = str(creds.scopes)
        db.commit()
        user_id = user.id
    finally:
        db.close()

    session_token = create_session_token(user_id)
    response = RedirectResponse(f"{settings.WEB_ORIGIN}/?connected=1")
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
    )
    return response


@router.get("/me")
def me(user_id: int = Depends(get_current_user_id)):
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.id == user_id).one_or_none()
        if not user:
            return JSONResponse({"error": "user not found"}, status_code=404)
        return {"id": user.id, "email": user.email}
    finally:
        db.close()


@router.post("/logout")
def logout():
    response = JSONResponse({"status": "logged_out"})
    response.delete_cookie(SESSION_COOKIE_NAME)
    return response
