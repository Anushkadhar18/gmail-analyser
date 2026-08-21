from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.backend.app.auth.token_store import get_credentials_for_user
from services.backend.app.auth.session import get_current_user_id
from services.backend.app.services.gmail import GmailService
from services.backend.app.ai.task_extractor import extract_tasks_from_text
from services.backend.app.db import SessionLocal
from services.backend.app import models
from datetime import datetime

router = APIRouter()


class ExtractRequest(BaseModel):
    message_id: str | None = None
    thread_id: str | None = None


class CompleteRequest(BaseModel):
    task_id: int
    completed: bool = True


@router.post("/extract")
def extract_tasks(req: ExtractRequest, user_id: int = Depends(get_current_user_id)):
    creds = get_credentials_for_user(user_id)
    if not creds:
        raise HTTPException(status_code=404, detail="credentials not found for user")

    svc = GmailService(creds)
    text = ""
    source_message_id = None
    if req.thread_id:
        thread = svc.get_thread(req.thread_id)
        parts = []
        for m in thread.get("messages", []):
            if m.get("snippet"):
                parts.append(m.get("snippet"))
        text = "\n\n".join(parts)
    elif req.message_id:
        msg = svc.get_email(req.message_id)
        text = msg.get("snippet", "")
        source_message_id = req.message_id

    tasks = extract_tasks_from_text(text)

    db = SessionLocal()
    stored = []
    try:
        for t in tasks:
            due = None
            try:
                if t.get("due_date"):
                    due = datetime.fromisoformat(t.get("due_date"))
            except Exception:
                due = None
            task = models.Task(user_id=user_id, source_message_id=source_message_id, description=t.get("description"), due_date=due, action_required=t.get("action_required"), meta=str(t))
            db.add(task)
            db.flush()
            stored.append({"id": task.id, "description": task.description, "due_date": task.due_date})
        db.commit()
        return {"extracted": stored}
    finally:
        db.close()


@router.get("/list")
def list_tasks(include_completed: bool = False, user_id: int = Depends(get_current_user_id)):
    db = SessionLocal()
    try:
        q = db.query(models.Task).filter(models.Task.user_id == user_id)
        if not include_completed:
            q = q.filter(models.Task.completed == 0)
        tasks = q.order_by(models.Task.created_at.desc()).all()
        return [
            {
                "id": t.id,
                "description": t.description,
                "due_date": t.due_date,
                "action_required": t.action_required,
                "completed": bool(t.completed),
                "source_message_id": t.source_message_id,
            }
            for t in tasks
        ]
    finally:
        db.close()


@router.post("/complete")
def complete_task(req: CompleteRequest, user_id: int = Depends(get_current_user_id)):
    db = SessionLocal()
    try:
        task = db.query(models.Task).filter(models.Task.id == req.task_id, models.Task.user_id == user_id).one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail="task not found")
        task.completed = 1 if req.completed else 0
        db.add(models.AuditLog(user_id=user_id, action="task_completed" if req.completed else "task_reopened", meta=str({"task_id": task.id})))
        db.commit()
        return {"id": task.id, "completed": bool(task.completed)}
    finally:
        db.close()
