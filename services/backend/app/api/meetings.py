from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.backend.app.auth.token_store import get_credentials_for_user
from services.backend.app.auth.session import get_current_user_id
from services.backend.app.services.calendar import CalendarService
from services.backend.app.services.gmail import GmailService
from services.backend.app.ai.meeting_brief import generate_meeting_brief
from services.backend.app.db import SessionLocal
from services.backend.app import models
import json
from services.worker.tasks import generate_meeting_brief_task

router = APIRouter()


class BriefRequest(BaseModel):
    event_id: str
    async_generate: bool = True


@router.post("/brief")
def brief(req: BriefRequest, user_id: int = Depends(get_current_user_id)):
    creds = get_credentials_for_user(user_id)
    if not creds:
        raise HTTPException(status_code=404, detail="credentials not found for user")
    svc = CalendarService(creds)
    # Fetch event
    try:
        ev = svc.service.events().get(calendarId="primary", eventId=req.event_id).execute()
    except Exception:
        raise HTTPException(status_code=404, detail="event not found")

    # Optionally generate asynchronously
    if req.async_generate:
        generate_meeting_brief_task.delay(user_id, req.event_id)
        return {"status": "queued"}

    # Synchronous
    # Try to find related emails by subject
    subject = ev.get("summary")
    emails = []
    try:
        gsvc = GmailService(creds)
        if subject:
            q = f"subject:(\"{subject}\")"
            emails = gsvc.search_emails(q, max_results=10)
    except Exception:
        emails = []

    brief_text, structured = generate_meeting_brief(ev, emails)
    db = SessionLocal()
    try:
        mb = models.MeetingBrief(user_id=user_id, event_id=req.event_id, brief=brief_text, structured=(json.dumps(structured) if structured else None))
        db.add(mb)
        db.add(models.AuditLog(user_id=user_id, action="meeting_brief_created", meta=str({"event_id": req.event_id, "brief_id": mb.id})))
        db.commit()
        db.refresh(mb)
        return {"brief_id": mb.id, "brief": mb.brief, "structured": structured}
    finally:
        db.close()


@router.get("/list")
def list_briefs(user_id: int = Depends(get_current_user_id)):
    db = SessionLocal()
    try:
        briefs = db.query(models.MeetingBrief).filter(models.MeetingBrief.user_id == user_id).order_by(models.MeetingBrief.created_at.desc()).all()
        return [
            {
                "id": b.id,
                "event_id": b.event_id,
                "brief": b.brief,
                "structured": json.loads(b.structured) if b.structured else None,
                "created_at": b.created_at,
            }
            for b in briefs
        ]
    finally:
        db.close()
