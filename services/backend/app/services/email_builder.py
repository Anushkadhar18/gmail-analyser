import base64
from email.message import EmailMessage


def build_raw_message(
    to_addr: str | None,
    subject: str | None,
    body: str,
    in_reply_to: str | None = None,
) -> str:
    """Build a base64url-encoded RFC2822 message, the format the Gmail API's
    drafts.create/messages.send expect for the `raw` field.
    """
    msg = EmailMessage()
    if to_addr:
        msg["To"] = to_addr
    msg["Subject"] = subject or ""
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = in_reply_to
    msg.set_content(body)
    return base64.urlsafe_b64encode(msg.as_bytes()).decode()
