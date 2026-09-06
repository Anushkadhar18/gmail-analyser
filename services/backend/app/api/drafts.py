from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.backend.app.auth.token_store import get_credentials_for_user
from services.backend.app.auth.session import get_current_user_id
from services.backend.app.services.gmail import GmailService
from services.backend.app.ai.llm import generate_draft_from_context
from services.backend.app.services.email_filters import is_likely_automated
from services.backend.app.services.email_builder import build_raw_message
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


class BatchGenerateRequest(BaseModel):
    query: str = "in:inbox newer_than:7d"
    max_results: int = 25


@router.post("/generate")
def generate_draft(req: GenerateDraftRequest, user_id: int = Depends(get_current_user_id)):
    creds = get_credentials_for_user(user_id)
    if not creds:
        raise HTTPException(status_code=404, detail="credentials not found for user")

    svc = GmailService(creds)
    context_parts = []
    thread_id = req.thread_id
    from_addr = None
    in_reply_to = None
    if thread_id:
        thread = svc.get_thread(thread_id)
        for msg in thread.get("messages", []):
            snippet = msg.get("snippet")
            if snippet:
                context_parts.append(snippet)
        if thread.get("messages"):
            last = thread["messages"][-1]
            from_addr = last.get("from")
            in_reply_to = (last.get("headers") or {}).get("message-id")
    elif req.message_id:
        msg = svc.get_email(req.message_id)
        if msg.get("snippet"):
            context_parts.append(msg.get("snippet"))
        from_addr = msg.get("from")
        in_reply_to = (msg.get("headers") or {}).get("message-id")

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

        # Best-effort: also create a real Gmail draft (source of truth for
        # approve/send stays this app's own Draft row either way).
        if from_addr:
            try:
                raw = build_raw_message(from_addr, req.subject, body, in_reply_to=in_reply_to)
                svc.create_draft(raw, thread_id=thread_id)
            except Exception:
                pass

        return {"draft_id": draft.id, "body": draft.body}
    finally:
        db.close()


@router.post("/batch_generate")
def batch_generate_drafts(req: BatchGenerateRequest, user_id: int = Depends(get_current_user_id)):
    """Scan the inbox and draft replies for real, not-yet-drafted threads.

    Selective by design: skips automated/no-reply/mailing-list senders (see
    email_filters.is_likely_automated) and any thread that already has a
    draft, so this is safe to re-run on a schedule without creating
    duplicates or replying to notifications. Never sends or approves
    anything — every draft lands with status="pending".
    """
    creds = get_credentials_for_user(user_id)
    if not creds:
        raise HTTPException(status_code=404, detail="credentials not found for user")

    svc = GmailService(creds)
    matches = svc.search_emails(req.query, max_results=req.max_results)

    db = SessionLocal()
    try:
        existing_thread_ids = {
            row[0]
            for row in db.query(models.Draft.thread_id)
            .filter(models.Draft.user_id == user_id, models.Draft.thread_id.isnot(None))
            .all()
        }

        created = []
        skipped = []
        for m in matches:
            msg = svc.get_email(m["id"])
            thread_id = msg.get("threadId")
            from_addr = msg.get("from") or ""
            subject = msg.get("subject") or ""
            headers = msg.get("headers") or {}

            if thread_id in existing_thread_ids:
                skipped.append({"subject": subject, "from": from_addr, "reason": "already drafted"})
                continue
            if is_likely_automated(from_addr, headers):
                skipped.append({"subject": subject, "from": from_addr, "reason": "automated/mailing-list sender"})
                continue

            context = msg.get("text") or msg.get("snippet") or ""
            if not context.strip():
                skipped.append({"subject": subject, "from": from_addr, "reason": "empty body"})
                continue

            body = generate_draft_from_context(subject, context)
            draft_subject = f"Re: {subject}" if subject else None
            draft = models.Draft(
                user_id=user_id,
                thread_id=thread_id,
                subject=draft_subject,
                body=body,
                status="pending",
            )
            db.add(draft)
            db.flush()
            db.add(models.AuditLog(
                user_id=user_id,
                action="draft_created",
                meta=str({"draft_id": draft.id, "source": "batch_generate"}),
            ))
            existing_thread_ids.add(thread_id)
            created.append({"id": draft.id, "subject": subject, "from": from_addr})

            # Best-effort: also create a real Gmail draft.
            try:
                in_reply_to = headers.get("message-id")
                raw = build_raw_message(from_addr, draft_subject, body, in_reply_to=in_reply_to)
                svc.create_draft(raw, thread_id=thread_id)
            except Exception:
                pass

        db.commit()
        return {"created": created, "skipped": skipped}
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
