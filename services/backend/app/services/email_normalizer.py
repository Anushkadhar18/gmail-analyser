import base64
from email import message_from_bytes
from typing import Dict, Any


def _decode_part(data: str) -> bytes:
    # Gmail API uses base64url
    padding = '=' * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _extract_text_from_payload(payload: Dict[str, Any]) -> Dict[str, str]:
    body_text = ""
    body_html = ""

    if not payload:
        return {"text": body_text, "html": body_html}

    # If payload has body.data, decode
    body = payload.get("body", {})
    if body.get("data"):
        try:
            raw = _decode_part(body.get("data"))
            msg = message_from_bytes(raw)
            if msg.is_multipart():
                for part in msg.walk():
                    ctype = part.get_content_type()
                    if ctype == "text/plain":
                        body_text += part.get_payload(decode=True).decode(errors="ignore")
                    elif ctype == "text/html":
                        body_html += part.get_payload(decode=True).decode(errors="ignore")
            else:
                # fallback to plain text
                body_text += msg.get_payload(decode=True).decode(errors="ignore")
            return {"text": body_text, "html": body_html}
        except Exception:
            pass

    # Otherwise check parts
    parts = payload.get("parts") or []
    for p in parts:
        mime = p.get("mimeType", "")
        bd = p.get("body", {})
        if bd.get("data"):
            try:
                raw = _decode_part(bd.get("data"))
                if mime == "text/plain":
                    body_text += raw.decode(errors="ignore")
                elif mime == "text/html":
                    body_html += raw.decode(errors="ignore")
                else:
                    # best-effort decode
                    body_text += raw.decode(errors="ignore")
            except Exception:
                continue

    return {"text": body_text, "html": body_html}


def normalize_message(msg: Dict[str, Any]) -> Dict[str, Any]:
    """Return a normalized message dict with keys: id, threadId, snippet, headers, subject, from, to, text, html"""
    payload = msg.get("payload") or {}
    headers = {}
    for h in payload.get("headers", []):
        headers[h.get("name").lower()] = h.get("value")

    bodies = _extract_text_from_payload(payload)

    return {
        "id": msg.get("id"),
        "threadId": msg.get("threadId"),
        "snippet": msg.get("snippet"),
        "headers": headers,
        "subject": headers.get("subject"),
        "from": headers.get("from"),
        "to": headers.get("to"),
        "text": bodies.get("text"),
        "html": bodies.get("html"),
    }
