from services.backend.app.db import SessionLocal
from services.backend.app import models
from services.backend.app.config import settings
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from services.backend.app.auth.crypto import decrypt


def get_credentials_for_user(user_id: int) -> Credentials | None:
    db = SessionLocal()
    try:
        token = db.query(models.Token).filter(models.Token.user_id == user_id).one_or_none()
        if not token:
            return None
        # tokens are stored encrypted; decrypt before building Credentials
        refresh_token = decrypt(token.refresh_token) or token.refresh_token
        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=[],
        )
        try:
            creds.refresh(Request())
        except Exception:
            # Refresh may fail; return creds anyway (service will attempt refresh later)
            pass
        return creds
    finally:
        db.close()
