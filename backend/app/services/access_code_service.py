import hashlib
import hmac
import secrets

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def normalize_access_code(value: str) -> str:
    return "".join(
        character
        for character in value.upper()
        if character.isalnum()
    )


def generate_access_code() -> str:
    raw = "".join(secrets.choice(ALPHABET) for _ in range(16))
    return "SB-" + "-".join(raw[index:index + 4] for index in range(0, 16, 4))


def access_code_hash(value: str) -> str:
    normalized = normalize_access_code(value)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def access_code_hint(value: str) -> str:
    return normalize_access_code(value)[-4:]


def verify_access_code(value: str, expected_hash: str | None) -> bool:
    if not value or not expected_hash:
        return False
    return hmac.compare_digest(access_code_hash(value), expected_hash)
