import os
import re
import json
from datetime import datetime, timedelta, timezone
from typing import Dict

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


def _llm_interpret(message: str) -> Dict | None:
    if not OPENAI_API_KEY:
        return None
    import requests

    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
    now = datetime.now(timezone.utc).isoformat()
    system = (
        "You are the intent router for a Gmail/Calendar assistant chat interface. "
        f"The current time is {now}. Classify the user's message into exactly one "
        "JSON object with an \"intent\" field of \"reply\", \"schedule\", or \"chat\":\n"
        "- reply: {\"intent\": \"reply\", \"subject\": string|null, \"body\": string} "
        "— body is a drafted email reply.\n"
        "- schedule: {\"intent\": \"schedule\", \"summary\": string, \"start\": ISO8601, "
        "\"end\": ISO8601, \"attendees\": [email, ...]} — a calendar event to propose.\n"
        "- chat: {\"intent\": \"chat\", \"reply\": string} — a conversational answer, no action.\n"
        "Return only the JSON object, nothing else."
    )
    data = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": message}],
        "max_tokens": 400,
    }
    resp = requests.post(url, headers=headers, data=json.dumps(data), timeout=15)
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    try:
        parsed = json.loads(content)
        if isinstance(parsed, dict) and parsed.get("intent") in ("reply", "schedule", "chat"):
            return parsed
    except Exception:
        pass
    return None


def _heuristic_interpret(message: str) -> Dict:
    """Best-effort keyword fallback used when OPENAI_API_KEY isn't set. Mirrors
    the fallback pattern in task_extractor.py / llm.py: no real NLU, just
    enough to keep the chat usable without an LLM key.
    """
    lower = message.lower()

    if any(kw in lower for kw in ("schedule", "meeting", "book a", "calendar")):
        start = datetime.now(timezone.utc) + timedelta(days=1)
        start = start.replace(hour=15, minute=0, second=0, microsecond=0)
        end = start + timedelta(minutes=30)
        return {
            "intent": "schedule",
            "summary": message.strip()[:120],
            "start": start.isoformat(),
            "end": end.isoformat(),
            "attendees": re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", message),
        }

    if any(kw in lower for kw in ("reply", "draft", "respond", "write back")):
        return {
            "intent": "reply",
            "subject": None,
            "body": "Hello,\n\nThank you for your message. I'll follow up shortly.\n\nBest regards,",
        }

    return {
        "intent": "chat",
        "reply": "I can draft email replies or propose calendar events — try phrasing your "
        "request with a word like \"reply\" or \"schedule\".",
    }


def interpret_message(message: str) -> Dict:
    return _llm_interpret(message) or _heuristic_interpret(message)
