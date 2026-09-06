import re

AUTOMATED_SENDER_PATTERN = re.compile(
    r"no-?reply|do-?not-?reply|notifications?@|mailer-daemon|accounts\.google\.com|calendar-notification",
    re.I,
)


def is_likely_automated(from_addr: str | None, headers: dict | None = None) -> bool:
    """Heuristic for senders that don't expect (or want) a reply: a
    no-reply/notification address, or a message carrying a
    List-Unsubscribe header (the standard RFC 2369 signal for mailing-list
    and marketing mail, which won't necessarily match the address pattern).
    Used to keep auto-drafting selective rather than replying to everything
    that lands in the inbox.
    """
    if from_addr and AUTOMATED_SENDER_PATTERN.search(from_addr):
        return True
    if headers and any(k.lower() == "list-unsubscribe" for k in headers):
        return True
    return False
