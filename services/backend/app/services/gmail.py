from typing import List
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from services.backend.app.services.email_normalizer import normalize_message


class GmailService:
    def __init__(self, credentials: Credentials):
        self.creds = credentials
        self.service = build("gmail", "v1", credentials=self.creds, cache_discovery=False)

    def search_emails(self, query: str, max_results: int = 25) -> List[dict]:
        resp = self.service.users().messages().list(userId="me", q=query, maxResults=max_results).execute()
        messages = resp.get("messages", [])
        results = []
        for m in messages:
            results.append({"id": m["id"]})
        return results

    def get_email(self, message_id: str) -> dict:
        msg = self.service.users().messages().get(userId="me", id=message_id, format="full").execute()
        try:
            return normalize_message(msg)
        except Exception:
            return msg

    def get_thread(self, thread_id: str) -> dict:
        thread = self.service.users().threads().get(userId="me", id=thread_id, format="full").execute()
        try:
            msgs = thread.get("messages", [])
            thread["messages"] = [normalize_message(m) for m in msgs]
            return thread
        except Exception:
            return thread

    def create_draft(self, raw_message: str) -> dict:
        # raw_message must be base64url-encoded RFC2822 message
        body = {"message": {"raw": raw_message}}
        draft = self.service.users().drafts().create(userId="me", body=body).execute()
        return draft

    def send_message(self, raw_message: str, allow_send: bool = False) -> dict:
        if not allow_send:
            raise PermissionError("Sending emails requires explicit approval")
        msg = self.service.users().messages().send(userId="me", body={"raw": raw_message}).execute()
        return msg
