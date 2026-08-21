import secrets
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from fastapi import Request, HTTPException
from services.backend.app.config import settings

SESSION_COOKIE_NAME = "session"
SESSION_MAX_AGE = 60 * 60 * 24 * 30  # 30 days
STATE_MAX_AGE = 60 * 10  # 10 minutes

_session_serializer = URLSafeTimedSerializer(settings.SECRET_KEY, salt="session")
_state_serializer = URLSafeTimedSerializer(settings.SECRET_KEY, salt="oauth-state")


def create_session_token(user_id: int) -> str:
    return _session_serializer.dumps({"user_id": user_id})


def read_session_token(token: str) -> int | None:
    try:
        data = _session_serializer.loads(token, max_age=SESSION_MAX_AGE)
        return data.get("user_id")
    except (BadSignature, SignatureExpired):
        return None


def get_current_user_id(request: Request) -> int:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="not authenticated")
    user_id = read_session_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="invalid or expired session")
    return user_id


def create_state_token() -> str:
    return _state_serializer.dumps({"nonce": secrets.token_urlsafe(16)})


def verify_state_token(token: str | None) -> bool:
    if not token:
        return False
    try:
        _state_serializer.loads(token, max_age=STATE_MAX_AGE)
        return True
    except (BadSignature, SignatureExpired):
        return False
