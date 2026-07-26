import os
import secrets
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


def normalize_database_url(value: str) -> str:
    value = value.strip()
    if value.startswith("sqlite://") and not value.startswith("sqlite+aiosqlite://"):
        return value.replace("sqlite://", "sqlite+aiosqlite://", 1)

    postgres_prefixes = (
        "postgres://",
        "postgresql://",
        "postgresql+psycopg2://",
        "postgresql+asyncpg://",
    )
    if not value.startswith(postgres_prefixes):
        return value

    parts = urlsplit(value)
    query = [
        (key, item)
        for key, item in parse_qsl(parts.query, keep_blank_values=True)
        if key not in {"sslmode", "channel_binding"}
    ]
    return urlunsplit(
        (
            "postgresql+asyncpg",
            parts.netloc,
            parts.path,
            urlencode(query),
            parts.fragment,
        )
    )


def missing_security_env() -> tuple[str, ...]:
    missing = [
        name
        for name in ("SECRET_KEY", "MASTER_RESET_CODE")
        if not os.getenv(name)
    ]
    if not (os.getenv("ADMIN_DEFAULT_PASSWORD") or os.getenv("ADMIN_PASSWORD_HASH")):
        missing.append("ADMIN_DEFAULT_PASSWORD/ADMIN_PASSWORD_HASH")
    if not (
        os.getenv("GABRIEL_DEFAULT_PASSWORD")
        or os.getenv("GABRIEL_PASSWORD_HASH")
    ):
        missing.append("GABRIEL_DEFAULT_PASSWORD/GABRIEL_PASSWORD_HASH")
    return tuple(missing)


class Config:
    MISSING_SECURITY_ENV = missing_security_env()

    DATABASE_URL = normalize_database_url(
        os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://USER:PASSWORD@HOST.neon.tech/neondb",
        )
    )
    DATABASE_SSL = os.getenv("DATABASE_SSL", "require")

    SECRET_KEY = os.getenv("SECRET_KEY") or secrets.token_urlsafe(48)
    FRONTEND_URL = os.getenv("FRONTEND_URL", "https://sebasbarber.netlify.app")
    MASTER_RESET_CODE = os.getenv("MASTER_RESET_CODE") or secrets.token_hex(32)

    ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "")
    GABRIEL_PASSWORD_HASH = os.getenv("GABRIEL_PASSWORD_HASH", "")
    ADMIN_PASSWORD_CONFIGURED = bool(
        os.getenv("ADMIN_DEFAULT_PASSWORD") or ADMIN_PASSWORD_HASH
    )
    GABRIEL_PASSWORD_CONFIGURED = bool(
        os.getenv("GABRIEL_DEFAULT_PASSWORD") or GABRIEL_PASSWORD_HASH
    )
    ADMIN_DEFAULT_PASSWORD = os.getenv("ADMIN_DEFAULT_PASSWORD", "")
    GABRIEL_DEFAULT_PASSWORD = os.getenv("GABRIEL_DEFAULT_PASSWORD", "")

    GOOGLE_CALENDAR_ID = os.getenv("GOOGLE_CALENDAR_ID", "sebasbarberg2021@gmail.com")
    GOOGLE_CREDENTIALS_FILE = os.getenv("GOOGLE_CREDENTIALS_FILE", "")
    GOOGLE_CREDENTIALS_JSON = os.getenv("GOOGLE_CREDENTIALS_JSON", "")
    GOOGLE_CREDENTIALS_B64 = os.getenv("GOOGLE_CREDENTIALS_B64", "")
    GOOGLE_SERVICE_ACCOUNT_JSON = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    GOOGLE_ICAL_URL = os.getenv(
        "GOOGLE_ICAL_URL",
        "https://calendar.google.com/calendar/ical/sebasbarberg2021%40gmail.com/public/basic.ics",
    )
    GOOGLE_EMBED_URL = os.getenv(
        "GOOGLE_EMBED_URL",
        "https://calendar.google.com/calendar/embed?src=sebasbarberg2021%40gmail.com&ctz=America%2FCosta_Rica",
    )
    CALENDAR_ENABLED = os.getenv("CALENDAR_ENABLED", "true").lower() == "true"
    CALENDAR_REQUIRED = os.getenv("CALENDAR_REQUIRED", "true").lower() == "true"

    APPOINTMENT_BUFFER_MIN = int(os.getenv("APPOINTMENT_BUFFER_MIN", "0"))
    SERVICE_CACHE_TTL_SECONDS = int(os.getenv("SERVICE_CACHE_TTL_SECONDS", "300"))

    EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "emailjs").lower()
    NOTIFY_EMAILS_ENABLED = os.getenv("NOTIFY_EMAILS_ENABLED", "false").lower() == "true"
    SMTP_HOST = os.getenv("SMTP_HOST", "")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)
    OWNER_EMAIL = os.getenv("OWNER_EMAIL", GOOGLE_CALENDAR_ID)

    SHOP_NAME = "Sebas Barber"
    ADDRESS = "C. 19, Provincia de Puntarenas, Espiritu Santo, Barrio Maranonal"
    LAT = 10.002565
    LNG = -84.657672
    GOOGLE_MAPS_URL = f"https://www.google.com/maps?q={LAT},{LNG}"
    WAZE_URL = f"https://waze.com/ul?ll={LAT},{LNG}&navigate=yes"

    OPEN_MIN = 8 * 60
    CLOSE_MIN = 19 * 60
    LUNCH_START = 12 * 60
    LUNCH_END = 13 * 60
    SLOT_STEP = 45


config = Config()
