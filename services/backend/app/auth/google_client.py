import os

# Google may grant a superset/subset of requested scopes (e.g. reordering,
# or including previously-granted scopes via include_granted_scopes). oauthlib
# treats that as an error unless this is set. This is Google's own documented
# workaround for google-auth-oauthlib. Must be set before Flow is used.
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
import requests
from services.backend.app.config import settings

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar.events",
    "openid",
    "email",
    "profile",
]


def _client_config():
    return {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.OAUTH_REDIRECT_URI],
        }
    }


def make_flow(scopes: list[str] | None = None):
    config = _client_config()
    flow = Flow.from_client_config(client_config=config, scopes=scopes or SCOPES, redirect_uri=settings.OAUTH_REDIRECT_URI)
    return flow


def exchange_code_for_credentials(code: str):
    flow = make_flow(scopes=SCOPES)
    try:
        flow.fetch_token(code=code)
        token_response = flow.credentials
        creds = Credentials(
            token=token_response.token,
            refresh_token=token_response.refresh_token,
            token_uri=token_response.token_uri,
            client_id=token_response.client_id,
            client_secret=token_response.client_secret,
            scopes=token_response.scopes,
        )
        return creds
    except Exception:
        return None


def get_userinfo(creds: Credentials) -> dict | None:
    try:
        resp = requests.get(
            "https://www.googleapis.com/oauth2/v1/userinfo",
            params={"alt": "json"},
            headers={"Authorization": f"Bearer {creds.token}"},
            timeout=5,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None
