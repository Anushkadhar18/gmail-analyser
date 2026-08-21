import os
import requests
import json
from typing import Tuple
from jsonschema import validate, ValidationError
from services.backend.app.ai.schemas import meeting_brief_schema

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


def _extract_json_from_text(text: str) -> dict | None:
    # Attempt to find a JSON object or array in the LLM output
    import re

    # look for first {...} or [..]
    m = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except Exception:
        return None


def generate_meeting_brief(event: dict, related_emails: list[dict] | None = None) -> Tuple[str, dict | None]:
    """Generate a meeting brief.

    Returns a tuple (brief_text, structured_dict_or_None).
    The structured dict contains keys: agenda (list), attendees (list), key_points (list), action_items (list of {description, owner, due_date}), summary (string).
    """
    parts = []
    parts.append(f"Event: {event.get('summary')}")
    start = event.get('start') or event.get('start', {})
    end = event.get('end') or event.get('end', {})
    parts.append(f"When: {start} - {end}")
    if event.get('description'):
        parts.append("Event description:\n" + event.get('description'))
    if related_emails:
        parts.append("Related emails snippets:\n")
        for e in related_emails[:5]:
            snippet = e.get('snippet') or e.get('body', '')
            parts.append(snippet)

    prompt_context = "\n\n".join(parts)

    system = (
        "You are an assistant that prepares structured meeting briefs. "
        "Return a JSON object with the following keys: \n"
        "- summary: short one-paragraph summary of the meeting\n"
        "- agenda: array of agenda items (strings)\n"
        "- attendees: array of attendee names or emails\n"
        "- key_points: array of short bullet points with the most important topics\n"
        "- action_items: array of objects {description, owner (optional), due_date (ISO or null)}\n"
        "Only output the JSON (no explanation). If you include explanatory text, still include the JSON object so it can be parsed."
    )

    if OPENAI_API_KEY:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
        data = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt_context},
            ],
            "max_tokens": 800,
        }
        try:
            resp = requests.post(url, headers=headers, data=json.dumps(data), timeout=20)
            resp.raise_for_status()
            j = resp.json()
            text = j["choices"][0]["message"]["content"]
            struct = _extract_json_from_text(text)
            if struct and isinstance(struct, dict):
                # validate schema
                try:
                    validate(instance=struct, schema=meeting_brief_schema)
                except ValidationError:
                    # If validation fails, ignore structured output
                    struct = None

            if struct and isinstance(struct, dict):
                # Build human-readable brief from structured content
                brief_lines = []
                brief_lines.append(struct.get("summary", f"Meeting: {event.get('summary')}"))
                if struct.get("agenda"):
                    brief_lines.append("\nAgenda:\n" + "\n".join([f"- {a}" for a in struct.get("agenda")]))
                if struct.get("key_points"):
                    brief_lines.append("\nKey points:\n" + "\n".join([f"- {k}" for k in struct.get("key_points")]))
                if struct.get("action_items"):
                    brief_lines.append(
                        "\nAction items:\n" + "\n".join([f"- {ai.get('description')} (owner: {ai.get('owner') or 'TBD'}, due: {ai.get('due_date') or 'TBD'})" for ai in struct.get("action_items")])
                    )
                brief_text = "\n\n".join(brief_lines)
                return brief_text, struct
        except Exception:
            pass

    # Fallback: minimal brief text with no structure
    brief_text = f"Meeting Brief for {event.get('summary')}\n\nWhen: {start} - {end}\n\n"
    brief_text += (event.get('description') or '')[:2000]
    return brief_text, None
