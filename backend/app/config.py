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
    SECRET_KEY_PREVIOUS = os.getenv("SECRET_KEY_PREVIOUS", "")
    JWT_ISSUER = "sebas-barber-api"
    JWT_AUDIENCE = "sebas-barber-admin"
    FRONTEND_URL = os.getenv("FRONTEND_URL", "https://sebasbarber.vercel.app")
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

    GOOGLE_CALENDAR_SEBASTIAN_ID = (
        os.getenv("GOOGLE_CALENDAR_SEBASTIAN_ID")
        or os.getenv("GOOGLE_CALENDAR_ID")
        or ""
    )
    GOOGLE_CALENDAR_GABRIEL_ID = os.getenv("GOOGLE_CALENDAR_GABRIEL_ID", "")
    GOOGLE_CREDENTIALS_FILE = os.getenv("GOOGLE_CREDENTIALS_FILE", "")
    GOOGLE_CREDENTIALS_JSON = os.getenv("GOOGLE_CREDENTIALS_JSON", "")
    GOOGLE_CREDENTIALS_B64 = os.getenv("GOOGLE_CREDENTIALS_B64", "")
    GOOGLE_SERVICE_ACCOUNT_JSON = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    CALENDAR_ENABLED = os.getenv("CALENDAR_ENABLED", "true").lower() == "true"
    CALENDAR_REQUIRED = os.getenv("CALENDAR_REQUIRED", "true").lower() == "true"

    APPOINTMENT_BUFFER_MIN = int(os.getenv("APPOINTMENT_BUFFER_MIN", "0"))
    SERVICE_CACHE_TTL_SECONDS = int(os.getenv("SERVICE_CACHE_TTL_SECONDS", "300"))
    REMINDERS_ENABLED = os.getenv("REMINDERS_ENABLED", "false").lower() == "true"
    REMINDER_LEAD_HOURS = int(os.getenv("REMINDER_LEAD_HOURS", "24"))
    REMINDER_BATCH_SIZE = int(os.getenv("REMINDER_BATCH_SIZE", "50"))
    REMINDER_TASK_TOKEN = os.getenv("REMINDER_TASK_TOKEN", "")
    DAILY_SUMMARY_HOUR = max(
        0,
        min(int(os.getenv("DAILY_SUMMARY_HOUR", "6")), 23),
    )
    NOTIFICATION_MAX_ATTEMPTS = max(
        int(os.getenv("NOTIFICATION_MAX_ATTEMPTS", "4")),
        1,
    )
    RETENTION_DAYS = max(int(os.getenv("RETENTION_DAYS", "730")), 90)
    CANCELLATION_NOTICE_HOURS = max(
        int(os.getenv("CANCELLATION_NOTICE_HOURS", "2")),
        0,
    )
    RESCHEDULE_NOTICE_HOURS = max(
        int(os.getenv("RESCHEDULE_NOTICE_HOURS", "2")),
        0,
    )
    RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
    SENTRY_DSN = os.getenv("SENTRY_DSN", "")
    LOYALTY_VISITS_TARGET = max(
        int(os.getenv("LOYALTY_VISITS_TARGET", "6")),
        2,
    )
    LOYALTY_REWARD_LABEL = os.getenv(
        "LOYALTY_REWARD_LABEL",
        "Beneficio especial en tu próxima visita",
    )

    CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
    GALLERY_UPLOAD_MAX_MB = max(
        int(os.getenv("GALLERY_UPLOAD_MAX_MB", "5")),
        1,
    )

    EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "emailjs").lower()
    NOTIFY_EMAILS_ENABLED = os.getenv("NOTIFY_EMAILS_ENABLED", "false").lower() == "true"
    SMTP_HOST = os.getenv("SMTP_HOST", "")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)
    OWNER_EMAIL = os.getenv("OWNER_EMAIL", "sebasbarberg2021@gmail.com")
    GABRIEL_EMAIL = os.getenv("GABRIEL_EMAIL", "")
    EMAILJS_SERVICE_ID = os.getenv("EMAILJS_SERVICE_ID", "")
    EMAILJS_TEMPLATE_CLIENTE = os.getenv("EMAILJS_TEMPLATE_CLIENTE", "")
    EMAILJS_TEMPLATE_BARBERO = os.getenv("EMAILJS_TEMPLATE_BARBERO", "")
    EMAILJS_PUBLIC_KEY = os.getenv("EMAILJS_PUBLIC_KEY", "")
    EMAILJS_PRIVATE_KEY = os.getenv("EMAILJS_PRIVATE_KEY", "")

    SHOP_NAME = "Sebas Barber"
    ADDRESS = "C. 19, Provincia de Puntarenas, Espíritu Santo, Barrio Marañonal"
    LAT = 10.002565
    LNG = -84.657672
    GOOGLE_MAPS_URL = f"https://www.google.com/maps?q={LAT},{LNG}"
    WAZE_URL = f"https://waze.com/ul?ll={LAT},{LNG}&navigate=yes"
    PARKING_INFO = os.getenv(
        "PARKING_INFO",
        "Hay espacio para estacionar cerca del local.",
    )
    DIRECTIONS_HINT = os.getenv(
        "DIRECTIONS_HINT",
        "Barrio Marañonal, Espíritu Santo de Esparza.",
    )

    OPEN_MIN = 8 * 60
    CLOSE_MIN = 19 * 60
    LUNCH_START = 12 * 60
    LUNCH_END = 13 * 60
    SLOT_STEP = 45


config = Config()
