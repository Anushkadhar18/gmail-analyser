import base64
import os

from fastapi import FastAPI, HTTPException
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CLIENT_SECRET_FILE = os.path.join(BASE_DIR, "client_secret.json")
TOKEN_FILE = os.path.join(BASE_DIR, "token.json")
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

app = FastAPI(title="Gmail Read-Only Test App")


def load_credentials():
    """Load cached credentials from token.json, refreshing if expired.

    Returns None if no usable credentials are available; never prints
    or logs the credential contents.
    """
    if not os.path.exists(TOKEN_FILE):
        return None

    creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(GoogleAuthRequest())
        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())

    return creds


def get_header(headers, name):
    for header in headers:
        if header.get("name", "").lower() == name.lower():
            return header.get("value", "")
    return ""


def _decode_body_data(data):
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")


def _find_body(payload):
    """Recursively search a Gmail message payload for plain-text and HTML bodies."""
    plain = None
    html = None

    mime_type = payload.get("mimeType", "")
    data = payload.get("body", {}).get("data")
    if data:
        if mime_type == "text/plain":
            plain = _decode_body_data(data)
        elif mime_type == "text/html":
            html = _decode_body_data(data)

    for part in payload.get("parts") or []:
        part_plain, part_html = _find_body(part)
        plain = plain or part_plain
        html = html or part_html

    return plain, html


def extract_body(payload):
    """Return the message body, preferring text/plain over text/html."""
    plain, html = _find_body(payload)
    return plain if plain is not None else (html or "")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/auth/google")
def auth_google():
    if not os.path.exists(CLIENT_SECRET_FILE):
        raise HTTPException(
            status_code=500,
            detail="client_secret.json not found in backend/. Download it from "
            "Google Cloud Console (OAuth client, Desktop app type) and place it there.",
        )

    try:
        flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, SCOPES)
        creds = flow.run_local_server(port=0, prompt="consent")
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"OAuth flow failed: {type(exc).__name__}"
        )

    with open(TOKEN_FILE, "w") as f:
        f.write(creds.to_json())

    return {"status": "authenticated"}


@app.get("/gmail/messages")
def gmail_messages():
    creds = load_credentials()
    if not creds or not creds.valid:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated. Call GET /auth/google first.",
        )

    try:
        service = build("gmail", "v1", credentials=creds)
        list_response = (
            service.users().messages().list(userId="me", maxResults=10).execute()
        )
        message_refs = list_response.get("messages", [])

        messages = []
        for ref in message_refs:
            msg = (
                service.users()
                .messages()
                .get(userId="me", id=ref["id"], format="full")
                .execute()
            )
            payload = msg.get("payload", {})
            headers = payload.get("headers", [])
            messages.append(
                {
                    "sender": get_header(headers, "From"),
                    "subject": get_header(headers, "Subject"),
                    "date": get_header(headers, "Date"),
                    "body": extract_body(payload),
                    "thread_id": msg.get("threadId"),
                }
            )

        return {"count": len(messages), "messages": messages}
    except HttpError as exc:
        status = getattr(exc.resp, "status", "unknown")
        raise HTTPException(
            status_code=502, detail=f"Gmail API error (status {status}): {exc.reason}"
        )
