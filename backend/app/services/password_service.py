import base64
import hashlib
import hmac
import os


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return "pbkdf2_sha256$" + _b64(salt) + "$" + _b64(digest)


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, salt_text, digest_text = stored_hash.split("$", 2)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_text.encode("ascii"))
        expected = base64.b64decode(digest_text.encode("ascii"))
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def _b64(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")

