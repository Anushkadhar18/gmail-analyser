import os
from celery import Celery

CELERY_BROKER = os.getenv('REDIS_URL', 'redis://redis:6379/0')

celery_app = Celery('worker', broker=CELERY_BROKER, backend=CELERY_BROKER)
celery_app.conf.timezone = "UTC"
celery_app.conf.beat_schedule = {
    "refresh-tokens-every-30-min": {
        "task": "services.worker.tasks.refresh_all_tokens_task",
        "schedule": 1800.0,
    },
    "sync-emails-every-5-min": {
        "task": "services.worker.tasks.sync_all_users_task",
        "schedule": 300.0,
    },
}


def _all_user_ids_with_tokens():
    from services.backend.app.db import SessionLocal
    from services.backend.app import models

    db = SessionLocal()
    try:
        return [row[0] for row in db.query(models.Token.user_id).distinct().all()]
    finally:
        db.close()


@celery_app.task
def fetch_emails_task(user_id: int, query: str = "newer_than:2d"):
    """Pull recent messages for a user and extract actionable tasks from any
    message that hasn't been processed yet (dedup via Task.source_message_id).
    """
    from services.backend.app.auth.token_store import get_credentials_for_user
    from services.backend.app.services.gmail import GmailService
    from services.backend.app.ai.task_extractor import extract_tasks_from_text
    from services.backend.app.db import SessionLocal
    from services.backend.app import models
    from datetime import datetime

    creds = get_credentials_for_user(user_id)
    if not creds:
        print(f"No credentials for user {user_id}")
        return False

    svc = GmailService(creds)
    try:
        matches = svc.search_emails(query, max_results=25)
    except Exception as e:
        print(f"Failed to search emails for user {user_id}: {e}")
        return False

    db = SessionLocal()
    processed = 0
    try:
        existing_ids = {
            row[0]
            for row in db.query(models.Task.source_message_id)
            .filter(models.Task.user_id == user_id, models.Task.source_message_id.isnot(None))
            .all()
        }
        for m in matches:
            message_id = m.get("id")
            if not message_id or message_id in existing_ids:
                continue
            try:
                msg = svc.get_email(message_id)
            except Exception as e:
                print(f"Failed to fetch message {message_id}: {e}")
                continue
            text = msg.get("text") or msg.get("snippet") or ""
            if not text:
                continue
            for t in extract_tasks_from_text(text):
                due = None
                try:
                    if t.get("due_date"):
                        due = datetime.fromisoformat(t.get("due_date"))
                except Exception:
                    due = None
                db.add(models.Task(
                    user_id=user_id,
                    source_message_id=message_id,
                    description=t.get("description"),
                    due_date=due,
                    action_required=t.get("action_required"),
                    meta=str(t),
                ))
            processed += 1
        db.add(models.AuditLog(
            user_id=user_id,
            action="emails_synced",
            meta=str({"query": query, "messages_seen": len(matches), "messages_processed": processed}),
        ))
        db.commit()
        print(f"fetch_emails_task: user {user_id} processed {processed}/{len(matches)} messages")
        return True
    finally:
        db.close()


@celery_app.task
def sync_all_users_task():
    user_ids = _all_user_ids_with_tokens()
    for uid in user_ids:
        fetch_emails_task.delay(uid)
    return len(user_ids)


@celery_app.task
def refresh_tokens_task(user_id: int):
    from services.backend.app.auth.token_store import get_credentials_for_user
    from services.backend.app.db import SessionLocal
    from services.backend.app import models

    creds = get_credentials_for_user(user_id)
    ok = bool(creds and creds.valid)
    db = SessionLocal()
    try:
        db.add(models.AuditLog(user_id=user_id, action="token_refreshed" if ok else "token_refresh_failed"))
        db.commit()
    finally:
        db.close()
    return ok


@celery_app.task
def refresh_all_tokens_task():
    user_ids = _all_user_ids_with_tokens()
    for uid in user_ids:
        refresh_tokens_task.delay(uid)
    return len(user_ids)


@celery_app.task
def send_draft_task(draft_id: int):
    # Load draft, build raw message, and send via GmailService
    from services.backend.app.db import SessionLocal
    from services.backend.app import models
    from services.backend.app.services.gmail import GmailService
    from services.backend.app.auth.token_store import get_credentials_for_user
    import base64
    from email.message import EmailMessage
    from datetime import datetime

    db = SessionLocal()
    try:
        draft = db.query(models.Draft).filter(models.Draft.id == draft_id).one_or_none()
        if not draft:
            print(f"Draft {draft_id} not found")
            return False

        if draft.status != "approved":
            print(f"Draft {draft.id} not approved; aborting send")
            return False

        creds = get_credentials_for_user(draft.user_id)
        if not creds:
            print(f"Failed to build credentials for user {draft.user_id}")
            return False

        svc = GmailService(creds)

        to_addr = ""
        in_reply_to = None
        references = None
        if draft.thread_id:
            try:
                thread = svc.get_thread(draft.thread_id)
                messages = thread.get("messages", [])
                if messages:
                    last = messages[-1]
                    to_addr = last.get("from") or (last.get("headers") or {}).get("from") or ""
                    in_reply_to = (last.get("headers") or {}).get("message-id")
                    references = in_reply_to
            except Exception:
                to_addr = ""

        msg = EmailMessage()
        msg["To"] = to_addr
        msg["Subject"] = draft.subject or ""
        if in_reply_to:
            msg["In-Reply-To"] = in_reply_to
        if references:
            msg["References"] = references
        msg.set_content(draft.body)
        raw_bytes = msg.as_bytes()
        raw_b64 = base64.urlsafe_b64encode(raw_bytes).decode()

        try:
            sent = svc.send_message(raw_b64, allow_send=True)
            draft.status = "sent"
            draft.sent_at = datetime.utcnow()
            db.add(models.AuditLog(user_id=draft.user_id, action="draft_sent", meta=str({"draft_id": draft.id, "sent_id": sent.get("id")})))
            db.commit()
            return True
        except Exception as e:
            print("Failed to send message:", e)
            return False
    finally:
        db.close()


@celery_app.task
def generate_meeting_brief_task(user_id: int, event_id: str):
    from services.backend.app.auth.token_store import get_credentials_for_user
    from services.backend.app.services.calendar import CalendarService
    from services.backend.app.services.gmail import GmailService
    from services.backend.app.ai.meeting_brief import generate_meeting_brief
    from services.backend.app.db import SessionLocal
    from services.backend.app import models

    creds = get_credentials_for_user(user_id)
    if not creds:
        print("No creds for user", user_id)
        return False
    csvc = CalendarService(creds)
    try:
        ev = csvc.service.events().get(calendarId="primary", eventId=event_id).execute()
    except Exception as e:
        print("Failed to fetch event", e)
        return False

    # Find related emails by subject
    subject = ev.get("summary")
    related = []
    try:
        gsvc = GmailService(creds)
        if subject:
            related = gsvc.search_emails(f'subject:("{subject}")', max_results=10)
    except Exception:
        related = []

    # generate_meeting_brief returns (brief_text, structured_dict_or_None)
    brief_text, structured = generate_meeting_brief(ev, related)
    db = SessionLocal()
    try:
        import json as _json

        mb = models.MeetingBrief(
            user_id=user_id,
            event_id=event_id,
            brief=brief_text,
            structured=(_json.dumps(structured) if structured else None),
        )
        db.add(mb)
        db.add(models.AuditLog(user_id=user_id, action="meeting_brief_created", meta=str({"event_id": event_id, "brief_id": mb.id})))
        db.commit()
        return True
    finally:
        db.close()


@celery_app.task
def extract_tasks_task(user_id: int, message_id: str | None = None, thread_id: str | None = None):
    from services.backend.app.auth.token_store import get_credentials_for_user
    from services.backend.app.services.gmail import GmailService
    from services.backend.app.ai.task_extractor import extract_tasks_from_text
    from services.backend.app.db import SessionLocal
    from services.backend.app import models
    from datetime import datetime

    creds = get_credentials_for_user(user_id)
    if not creds:
        print("No creds for user", user_id)
        return False
    svc = GmailService(creds)
    text = ""
    source_message_id = None
    if thread_id:
        thread = svc.get_thread(thread_id)
        parts = []
        for m in thread.get("messages", []):
            if m.get("snippet"):
                parts.append(m.get("snippet"))
        text = "\n\n".join(parts)
    elif message_id:
        msg = svc.get_email(message_id)
        text = msg.get("snippet", "")
        source_message_id = message_id

    tasks = extract_tasks_from_text(text)
    db = SessionLocal()
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
        db.commit()
        print(f"Extracted {len(tasks)} tasks for user {user_id}")
        return True
    finally:
        db.close()
