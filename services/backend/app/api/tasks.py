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


class CreateTaskRequest(BaseModel):
    description: str
    due_date: str | None = None
    action_required: str | None = None
    important: bool = False
    notes: str | None = None


class UpdateTaskRequest(BaseModel):
    task_id: int
    description: str | None = None
    due_date: str | None = None
    clear_due_date: bool = False
    notes: str | None = None
    important: bool | None = None


class TaskIdRequest(BaseModel):
    task_id: int


def _serialize(t: models.Task) -> dict:
    return {
        "id": t.id,
        "description": t.description,
        "due_date": t.due_date,
        "action_required": t.action_required,
        "completed": bool(t.completed),
        "important": bool(t.important),
        "notes": t.notes,
        "source_message_id": t.source_message_id,
    }


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


@router.post("/create")
def create_task(req: CreateTaskRequest, user_id: int = Depends(get_current_user_id)):
    """Manually add a task, independent of email extraction."""
    if not req.description.strip():
        raise HTTPException(status_code=400, detail="description is required")

    due = None
    if req.due_date:
        try:
            due = datetime.fromisoformat(req.due_date)
        except Exception:
            raise HTTPException(status_code=400, detail="due_date must be ISO 8601 (e.g. 2026-09-10T15:00:00)")

    db = SessionLocal()
    try:
        task = models.Task(
            user_id=user_id,
            source_message_id=None,
            description=req.description.strip(),
            due_date=due,
            action_required=req.action_required,
            important=1 if req.important else 0,
            notes=req.notes,
        )
        db.add(task)
        db.flush()
        db.add(models.AuditLog(user_id=user_id, action="task_created_manually", meta=str({"task_id": task.id})))
        db.commit()
        return _serialize(task)
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
        return [_serialize(t) for t in tasks]
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


@router.post("/update")
def update_task(req: UpdateTaskRequest, user_id: int = Depends(get_current_user_id)):
    """Edit a task's description/due date/notes/important flag after creation."""
    db = SessionLocal()
    try:
        task = db.query(models.Task).filter(models.Task.id == req.task_id, models.Task.user_id == user_id).one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail="task not found")

        if req.description is not None:
            if not req.description.strip():
                raise HTTPException(status_code=400, detail="description can't be empty")
            task.description = req.description.strip()
        if req.clear_due_date:
            task.due_date = None
        elif req.due_date is not None:
            try:
                task.due_date = datetime.fromisoformat(req.due_date)
            except Exception:
                raise HTTPException(status_code=400, detail="due_date must be ISO 8601 (e.g. 2026-09-10T15:00:00)")
        if req.notes is not None:
            task.notes = req.notes
        if req.important is not None:
            task.important = 1 if req.important else 0

        db.add(models.AuditLog(user_id=user_id, action="task_updated", meta=str({"task_id": task.id})))
        db.commit()
        db.refresh(task)
        return _serialize(task)
    finally:
        db.close()


@router.post("/delete")
def delete_task(req: TaskIdRequest, user_id: int = Depends(get_current_user_id)):
    db = SessionLocal()
    try:
        task = db.query(models.Task).filter(models.Task.id == req.task_id, models.Task.user_id == user_id).one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail="task not found")
        db.delete(task)
        db.add(models.AuditLog(user_id=user_id, action="task_deleted", meta=str({"task_id": req.task_id})))
        db.commit()
        return {"status": "deleted", "task_id": req.task_id}
    finally:
        db.close()
