from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.backend.app.auth.token_store import get_credentials_for_user
from services.backend.app.auth.session import get_current_user_id
from services.backend.app.services.gmail import GmailService
from services.backend.app.ai.llm import analyze_and_draft_reply
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


class UpdateDraftRequest(BaseModel):
    draft_id: int
    subject: str | None = None
    body: str | None = None


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
        # Full text per message, not just Gmail's truncated snippet, and
        # labeled by sender — the drafting prompt needs real thread context,
        # not just the latest line.
        for msg in thread.get("messages", []):
            text = msg.get("text") or msg.get("snippet") or ""
            if text.strip():
                context_parts.append(f"From: {msg.get('from', 'unknown')}\n{text.strip()}")
        if thread.get("messages"):
            last = thread["messages"][-1]
            from_addr = last.get("from")
            in_reply_to = (last.get("headers") or {}).get("message-id")
    elif req.message_id:
        msg = svc.get_email(req.message_id)
        text = msg.get("text") or msg.get("snippet") or ""
        if text.strip():
            context_parts.append(f"From: {msg.get('from', 'unknown')}\n{text.strip()}")
        from_addr = msg.get("from")
        in_reply_to = (msg.get("headers") or {}).get("message-id")

    context = "\n\n---\n\n".join(context_parts)
    result = analyze_and_draft_reply(req.subject, context)

    if not result.get("reply_required"):
        return {
            "draft_id": None,
            "reply_required": False,
            "reply_type": result.get("reply_type"),
            "reason": "This email doesn't look like it needs a reply.",
        }

    body = result["draft"]

    db = SessionLocal()
    try:
        draft = models.Draft(user_id=user_id, thread_id=thread_id, subject=req.subject, body=body, status="pending")
        db.add(draft)
        db.flush()
        db.add(models.AuditLog(user_id=user_id, action="draft_created", meta=str({
            "draft_id": draft.id,
            "reply_type": result.get("reply_type"),
            "tone": result.get("tone"),
            "confidence": result.get("confidence"),
        })))
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

        return {
            "draft_id": draft.id,
            "body": draft.body,
            "tone": result.get("tone"),
            "confidence": result.get("confidence"),
            "reply_type": result.get("reply_type"),
        }
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

            result = analyze_and_draft_reply(subject, context)
            if not result.get("reply_required"):
                skipped.append({
                    "subject": subject,
                    "from": from_addr,
                    "reason": f"no reply needed ({result.get('reply_type', 'n/a')})",
                })
                continue

            body = result["draft"]
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
                meta=str({
                    "draft_id": draft.id,
                    "source": "batch_generate",
                    "reply_type": result.get("reply_type"),
                    "tone": result.get("tone"),
                    "confidence": result.get("confidence"),
                }),
            ))
            existing_thread_ids.add(thread_id)
            created.append({"id": draft.id, "subject": subject, "from": from_addr, "tone": result.get("tone")})

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


@router.post("/update")
def update_draft(req: UpdateDraftRequest, user_id: int = Depends(get_current_user_id)):
    """Edit a draft's subject/body before it's sent.

    Editing an already-approved draft resets it to "pending" — you're
    changing what was approved, so it needs a fresh approval. Editing after
    it's queued/sent is rejected outright; that copy is already on its way.
    """
    db = SessionLocal()
    try:
        draft = db.query(models.Draft).filter(models.Draft.id == req.draft_id, models.Draft.user_id == user_id).one_or_none()
        if not draft:
            raise HTTPException(status_code=404, detail="draft not found")
        if draft.status in ("queued", "sent"):
            raise HTTPException(status_code=400, detail=f"draft is already {draft.status}, can't edit it now")

        if req.subject is not None:
            draft.subject = req.subject
        if req.body is not None:
            if not req.body.strip():
                raise HTTPException(status_code=400, detail="body can't be empty")
            draft.body = req.body

        reverted = draft.status == "approved"
        if reverted:
            draft.status = "pending"
            draft.approved_at = None

        db.add(models.AuditLog(user_id=user_id, action="draft_edited", meta=str({
            "draft_id": draft.id,
            "reverted_to_pending": reverted,
        })))
        db.commit()
        db.refresh(draft)
        return {"id": draft.id, "subject": draft.subject, "body": draft.body, "status": draft.status}
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


@router.post("/reject")
def reject_draft(req: ActionRequest, user_id: int = Depends(get_current_user_id)):
    """Dismiss a draft you don't want — the only way to get a draft out of
    the pending/approval queue without sending it.
    """
    db = SessionLocal()
    try:
        draft = db.query(models.Draft).filter(models.Draft.id == req.draft_id, models.Draft.user_id == user_id).one_or_none()
        if not draft:
            raise HTTPException(status_code=404, detail="draft not found")
        if draft.status in ("queued", "sent"):
            raise HTTPException(status_code=400, detail=f"draft is already {draft.status}, can't reject it now")
        draft.status = "rejected"
        db.add(models.AuditLog(user_id=user_id, action="draft_rejected", meta=str({"draft_id": draft.id})))
        db.commit()
        return {"status": "rejected", "draft_id": draft.id}
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
