from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.backend.app.auth.token_store import get_credentials_for_user
from services.backend.app.auth.session import get_current_user_id
from services.backend.app.services.gmail import GmailService
from services.backend.app.ai.llm import generate_draft_from_context
from services.backend.app.db import SessionLocal
from services.backend.app import models
from services.worker.tasks import send_draft_task
from datetime import datetime

router = APIRouter()


class GenerateDraftRequest(BaseModel):
    thread_id: str | None = None
    message_id: str | None = None
    subject: str | None = None


class ActionRequest(BaseModel):
    draft_id: int


@router.post("/generate")
def generate_draft(req: GenerateDraftRequest, user_id: int = Depends(get_current_user_id)):
    creds = get_credentials_for_user(user_id)
    if not creds:
        raise HTTPException(status_code=404, detail="credentials not found for user")

    svc = GmailService(creds)
    context_parts = []
    thread_id = req.thread_id
    if thread_id:
        thread = svc.get_thread(thread_id)
        for msg in thread.get("messages", []):
            snippet = msg.get("snippet")
            if snippet:
                context_parts.append(snippet)
    elif req.message_id:
        msg = svc.get_email(req.message_id)
        if msg.get("snippet"):
            context_parts.append(msg.get("snippet"))

    context = "\n\n".join(context_parts)
    body = generate_draft_from_context(req.subject, context)

    db = SessionLocal()
    try:
        draft = models.Draft(user_id=user_id, thread_id=thread_id, subject=req.subject, body=body, status="pending")
        db.add(draft)
        db.flush()
        # audit
        db.add(models.AuditLog(user_id=user_id, action="draft_created", meta=str({"draft_id": draft.id})))
        db.commit()
        db.refresh(draft)
        return {"draft_id": draft.id, "body": draft.body}
    finally:
        db.close()


@router.get("/list")
def list_drafts(user_id: int = Depends(get_current_user_id)):
    db = SessionLocal()
    try:
        drafts = db.query(models.Draft).filter(models.Draft.user_id == user_id).order_by(models.Draft.created_at.desc()).all()
        return [{"id": d.id, "subject": d.subject, "body": d.body, "status": d.status} for d in drafts]
    finally:
        db.close()


@router.post("/approve")
def approve_draft(req: ActionRequest, user_id: int = Depends(get_current_user_id)):
    db = SessionLocal()
    try:
        draft = db.query(models.Draft).filter(models.Draft.id == req.draft_id, models.Draft.user_id == user_id).one_or_none()
        if not draft:
            raise HTTPException(status_code=404, detail="draft not found")
        draft.status = "approved"
        draft.approved_at = datetime.utcnow()
        db.add(models.AuditLog(user_id=user_id, action="draft_approved", meta=str({"draft_id": draft.id})))
        db.commit()
        return {"status": "approved", "draft_id": draft.id}
    finally:
        db.close()


@router.post("/send")
def send_draft(req: ActionRequest, user_id: int = Depends(get_current_user_id)):
    db = SessionLocal()
    try:
        draft = db.query(models.Draft).filter(models.Draft.id == req.draft_id, models.Draft.user_id == user_id).one_or_none()
        if not draft:
            raise HTTPException(status_code=404, detail="draft not found")
        if draft.status != "approved":
            raise HTTPException(status_code=400, detail="draft must be approved before sending")
        # enqueue send task
        send_draft_task.delay(draft.id)
        db.add(models.AuditLog(user_id=user_id, action="draft_send_requested", meta=str({"draft_id": draft.id})))
        db.commit()
        return {"status": "queued", "draft_id": draft.id}
    finally:
        db.close()
