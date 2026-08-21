from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.backend.app.auth.token_store import get_credentials_for_user
from services.backend.app.auth.session import get_current_user_id
from services.backend.app.services.calendar import CalendarService

router = APIRouter()


class EventsRequest(BaseModel):
    calendar_id: str = "primary"
    time_min: str | None = None


class FreeSlotRequest(BaseModel):
    duration_minutes: int = 30
    window_days: int = 7


class CreateEventRequest(BaseModel):
    event: dict
    approve: bool = False


@router.post("/get_events")
def get_events(req: EventsRequest, user_id: int = Depends(get_current_user_id)):
    creds = get_credentials_for_user(user_id)
    if not creds:
        raise HTTPException(status_code=404, detail="credentials not found for user")
    svc = CalendarService(creds)
    events = svc.get_events(calendar_id=req.calendar_id, time_min=req.time_min)
    return {"events": events}


@router.post("/find_free_slots")
def find_free_slots(req: FreeSlotRequest, user_id: int = Depends(get_current_user_id)):
    creds = get_credentials_for_user(user_id)
    if not creds:
        raise HTTPException(status_code=404, detail="credentials not found for user")
    svc = CalendarService(creds)
    slots = svc.find_free_slots(duration_minutes=req.duration_minutes, window_days=req.window_days)
    return {"free_slots": slots}


@router.post("/create_event")
def create_event(req: CreateEventRequest, user_id: int = Depends(get_current_user_id)):
    if not req.approve:
        raise HTTPException(status_code=400, detail="creating events requires explicit approval")
    creds = get_credentials_for_user(user_id)
    if not creds:
        raise HTTPException(status_code=404, detail="credentials not found for user")
    svc = CalendarService(creds)
    created = svc.service.events().insert(calendarId="primary", body=req.event).execute()
    return created


@router.post("/update_event")
def update_event(req: CreateEventRequest, user_id: int = Depends(get_current_user_id)):
    if not req.approve:
        raise HTTPException(status_code=400, detail="updating events requires explicit approval")
    creds = get_credentials_for_user(user_id)
    if not creds:
        raise HTTPException(status_code=404, detail="credentials not found for user")
    svc = CalendarService(creds)
    ev = req.event
    event_id = ev.get("id")
    if not event_id:
        raise HTTPException(status_code=400, detail="event must include id for update")
    updated = svc.service.events().update(calendarId="primary", eventId=event_id, body=ev).execute()
    return updated
