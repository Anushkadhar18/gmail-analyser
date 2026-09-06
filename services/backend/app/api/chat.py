from fastapi import APIRouter, Depends
from pydantic import BaseModel
from services.backend.app.auth.session import get_current_user_id
from services.backend.app.ai.chat import interpret_message
from services.backend.app.db import SessionLocal
from services.backend.app import models

router = APIRouter()


class ChatMessageRequest(BaseModel):
    message: str


@router.post("/message")
def send_chat_message(req: ChatMessageRequest, user_id: int = Depends(get_current_user_id)):
    result = interpret_message(req.message)
    intent = result.get("intent")

    if intent == "reply":
        db = SessionLocal()
        try:
            draft = models.Draft(
                user_id=user_id,
                subject=result.get("subject"),
                body=result.get("body", ""),
                status="pending",
            )
            db.add(draft)
            db.flush()
            db.add(models.AuditLog(user_id=user_id, action="draft_created", meta=str({"draft_id": draft.id, "source": "chat"})))
            db.commit()
            db.refresh(draft)
            return {
                "intent": "reply",
                "reply_text": f"I've drafted a reply (draft #{draft.id}). Review and approve it on the Drafts page before it sends.",
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
