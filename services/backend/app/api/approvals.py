from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.backend.app.auth.session import get_current_user_id
from services.backend.app.db import SessionLocal
from services.backend.app import models
from datetime import datetime

router = APIRouter()


class ApprovalRequestCreate(BaseModel):
    draft_id: int | None = None
    event_id: str | None = None
    reason: str | None = None


class ApprovalAction(BaseModel):
    approval_id: int
    approve: bool


@router.post("/request")
def request_approval(req: ApprovalRequestCreate, user_id: int = Depends(get_current_user_id)):
    db = SessionLocal()
    try:
        ar = models.ApprovalRequest(user_id=user_id, draft_id=req.draft_id, event_id=req.event_id, reason=req.reason, status="pending")
        db.add(ar)
        db.flush()
        db.add(models.AuditLog(user_id=user_id, action="approval_requested", meta=str({"approval_id": ar.id})))
        db.commit()
        db.refresh(ar)
        return {"approval_id": ar.id, "status": ar.status}
    finally:
        db.close()


@router.get("/pending")
def list_pending(user_id: int = Depends(get_current_user_id)):
    db = SessionLocal()
    try:
        items = db.query(models.ApprovalRequest).filter(models.ApprovalRequest.status == "pending", models.ApprovalRequest.user_id == user_id).all()
        return [{"id": i.id, "user_id": i.user_id, "draft_id": i.draft_id, "event_id": i.event_id, "reason": i.reason} for i in items]
    finally:
        db.close()


@router.post("/review")
def review_approval(action: ApprovalAction, user_id: int = Depends(get_current_user_id)):
    db = SessionLocal()
    try:
        ar = db.query(models.ApprovalRequest).filter(models.ApprovalRequest.id == action.approval_id, models.ApprovalRequest.user_id == user_id).one_or_none()
        if not ar:
            raise HTTPException(status_code=404, detail="approval not found")
        ar.status = "approved" if action.approve else "rejected"
        ar.reviewed_at = datetime.utcnow()
        db.add(models.AuditLog(user_id=user_id, action="approval_reviewed", meta=str({"approval_id": ar.id, "approve": action.approve})))
        # If approval for draft, update draft status when approved
        if action.approve and ar.draft_id:
            draft = db.query(models.Draft).filter(models.Draft.id == ar.draft_id).one_or_none()
            if draft:
                draft.status = "approved"
                draft.approved_at = datetime.utcnow()
        db.commit()
        return {"id": ar.id, "status": ar.status}
    finally:
        db.close()
