from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from services.backend.app.auth.session import get_current_user_id
from services.backend.app.auth.token_store import get_credentials_for_user
from services.backend.app.ai.chat import interpret_message
from services.backend.app.ai.llm import generate_draft_from_context
from services.backend.app.services.gmail import GmailService
from services.backend.app.services.email_filters import is_likely_automated
from services.backend.app.services.email_builder import build_raw_message
from services.backend.app.db import SessionLocal
from services.backend.app import models

router = APIRouter()

_REPLY_TO_RECENT_KEYWORDS = ("recent", "latest", "last email", "newest")


class ChatMessageRequest(BaseModel):
    message: str


@router.post("/message")
def send_chat_message(req: ChatMessageRequest, user_id: int = Depends(get_current_user_id)):
    result = interpret_message(req.message)
    intent = result.get("intent")

    if intent == "reply":
        creds = get_credentials_for_user(user_id)
        if not creds:
            raise HTTPException(status_code=404, detail="credentials not found for user")

        svc = GmailService(creds)
        thread_id = None
        subject = result.get("subject")
        from_addr = None
        in_reply_to = None
        body = result.get("body", "")

        # If the request refers to a specific recent message ("reply to the
        # latest email"), pull it and draft against its actual content
        # instead of the generic fallback body from interpret_message.
        if any(kw in req.message.lower() for kw in _REPLY_TO_RECENT_KEYWORDS):
            matches = svc.search_emails("in:inbox", max_results=1)
            if not matches:
                return {"intent": "chat", "reply_text": "Your inbox looks empty — nothing to reply to."}

            msg = svc.get_email(matches[0]["id"])
            subject = msg.get("subject")
            from_addr = msg.get("from")
            headers = msg.get("headers") or {}

            if is_likely_automated(from_addr, headers):
                return {
                    "intent": "chat",
                    "reply_text": f"The most recent email (\"{subject}\" from {from_addr}) looks automated "
                    "or unsubscribable, so I skipped drafting a reply to it.",
                }

            thread_id = msg.get("threadId")
            in_reply_to = headers.get("message-id")
            db_check = SessionLocal()
            try:
                existing = db_check.query(models.Draft).filter(
                    models.Draft.user_id == user_id, models.Draft.thread_id == thread_id
                ).one_or_none()
            finally:
                db_check.close()
            if existing:
                return {
                    "intent": "chat",
                    "reply_text": f"There's already a draft (#{existing.id}, status={existing.status}) for "
                    f"\"{subject}\" from {from_addr} — see it on the Drafts page.",
                }

            context = msg.get("text") or msg.get("snippet") or ""
            body = generate_draft_from_context(subject, context)

        draft_subject = f"Re: {subject}" if subject and thread_id else subject
        db = SessionLocal()
        try:
            draft = models.Draft(
                user_id=user_id,
                thread_id=thread_id,
                subject=draft_subject,
                body=body,
                status="pending",
            )
            db.add(draft)
            db.flush()
            db.add(models.AuditLog(user_id=user_id, action="draft_created", meta=str({"draft_id": draft.id, "source": "chat"})))
            db.commit()
            db.refresh(draft)

            # Best-effort: also create a real Gmail draft so it shows up in
            # the user's actual Drafts folder, not just this app's own list.
            # This app's Draft row remains the source of truth for
            # approve/send either way, so a failure here doesn't block that.
            gmail_draft_created = False
            if from_addr:
                try:
                    raw = build_raw_message(from_addr, draft_subject, body, in_reply_to=in_reply_to)
                    svc.create_draft(raw, thread_id=thread_id)
                    gmail_draft_created = True
                except Exception:
                    pass

            reply_text = f"I've drafted a reply (draft #{draft.id})"
            reply_text += f" to \"{subject}\" from {from_addr}" if from_addr else ""
            reply_text += ". Review and approve it on the Drafts page before it sends."
            if from_addr and not gmail_draft_created:
                reply_text += " (Note: couldn't also save it as a real Gmail draft — it still exists here.)"
            return {
                "intent": "reply",
                "reply_text": reply_text,
                "draft_id": draft.id,
                "draft_body": draft.body,
            }
        finally:
            db.close()

    if intent == "schedule":
        return {
            "intent": "schedule",
            "reply_text": f"I can schedule \"{result.get('summary')}\" from {result.get('start')} to {result.get('end')}. Confirm to create it on your calendar.",
            "proposed_event": {
                "summary": result.get("summary"),
                "start": {"dateTime": result.get("start")},
                "end": {"dateTime": result.get("end")},
                "attendees": [{"email": a} for a in result.get("attendees", [])],
            },
        }

    return {"intent": "chat", "reply_text": result.get("reply", "")}
