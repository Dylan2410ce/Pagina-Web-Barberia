import base64
import hashlib
import json

from cryptography.fernet import Fernet, InvalidToken

from app.config import config


def request_fingerprint(payload: dict) -> str:
    normalized = {
        key: value
        for key, value in payload.items()
        if key not in {"request_id", "website"}
    }
    source = json.dumps(
        normalized,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def _fernet(secret: str) -> Fernet:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_access_code(value: str) -> str:
    return _fernet(config.SECRET_KEY).encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_access_code(value: str | None) -> str | None:
    if not value:
        return None
    secrets = [config.SECRET_KEY, config.SECRET_KEY_PREVIOUS]
    for secret in secrets:
        if not secret:
            continue
        try:
            return _fernet(secret).decrypt(value.encode("ascii")).decode("utf-8")
        except (InvalidToken, ValueError):
            continue
    return None
