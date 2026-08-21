from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.backend.app.auth.token_store import get_credentials_for_user
from services.backend.app.auth.session import get_current_user_id
from services.backend.app.services.gmail import GmailService

router = APIRouter()


class SearchRequest(BaseModel):
    query: str
    max_results: int = 25


class IdRequest(BaseModel):
    id: str


class DraftRequest(BaseModel):
    raw_message: str
    approve_send: bool = False


@router.post("/search_emails")
def search_emails(req: SearchRequest, user_id: int = Depends(get_current_user_id)):
    creds = get_credentials_for_user(user_id)
    if not creds:
        raise HTTPException(status_code=404, detail="credentials not found for user")
    svc = GmailService(creds)
    results = svc.search_emails(req.query, max_results=req.max_results)
    return {"results": results}


@router.post("/get_email")
def get_email(req: IdRequest, user_id: int = Depends(get_current_user_id)):
    creds = get_credentials_for_user(user_id)
    if not creds:
        raise HTTPException(status_code=404, detail="credentials not found for user")
    svc = GmailService(creds)
    msg = svc.get_email(req.id)
    return msg


@router.post("/get_thread")
def get_thread(req: IdRequest, user_id: int = Depends(get_current_user_id)):
    creds = get_credentials_for_user(user_id)
    if not creds:
        raise HTTPException(status_code=404, detail="credentials not found for user")
    svc = GmailService(creds)
    thread = svc.get_thread(req.id)
    return thread


@router.post("/create_draft")
def create_draft(req: DraftRequest, user_id: int = Depends(get_current_user_id)):
    creds = get_credentials_for_user(user_id)
    if not creds:
        raise HTTPException(status_code=404, detail="credentials not found for user")
    svc = GmailService(creds)
    draft = svc.create_draft(req.raw_message)
    return draft


@router.post("/send_email")
def send_email(req: DraftRequest, user_id: int = Depends(get_current_user_id)):
    if not req.approve_send:
        raise HTTPException(status_code=400, detail="send requires explicit approval")
    creds = get_credentials_for_user(user_id)
    if not creds:
        raise HTTPException(status_code=404, detail="credentials not found for user")
    svc = GmailService(creds)
    sent = svc.send_message(req.raw_message, allow_send=True)
    return sent
