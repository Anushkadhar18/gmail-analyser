from cryptography.fernet import Fernet, InvalidToken
import os


def _get_key() -> bytes:
    # Read live from the environment (rather than the cached Settings object)
    # so tests and key-rotation scripts can set/override it at runtime.
    key = os.getenv("TOKEN_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError("TOKEN_ENCRYPTION_KEY not set")
    return key.encode()


def encrypt(value: str) -> str:
    f = Fernet(_get_key())
    return f.encrypt(value.encode()).decode()


def decrypt(token: str) -> str | None:
    try:
        f = Fernet(_get_key())
        return f.decrypt(token.encode()).decode()
    except (InvalidToken, Exception):
        return None
