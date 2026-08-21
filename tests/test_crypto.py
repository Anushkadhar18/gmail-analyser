from services.backend.app.auth.crypto import encrypt, decrypt


def test_encrypt_decrypt_roundtrip():
    secret = "my-refresh-token-123"
    # Requires TOKEN_ENCRYPTION_KEY to be set in the environment for real runs.
    # For unit test, we generate a key dynamically by calling Fernet directly.
    from cryptography.fernet import Fernet
    import os

    k = Fernet.generate_key().decode()
    os.environ["TOKEN_ENCRYPTION_KEY"] = k

    enc = encrypt(secret)
    dec = decrypt(enc)
    assert dec == secret
