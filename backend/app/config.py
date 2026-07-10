import os


class Config:
    # Neon usa PostgreSQL, no MySQL. Pega aqui tu connection string de Neon.
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require",
    )

    SECRET_KEY = os.getenv("SECRET_KEY", "sebas-barber-render-secret-key")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "https://barberiasebas.netlify.app")
    MASTER_RESET_CODE = os.getenv(
        "MASTER_RESET_CODE",
        "SBs7LVAiZawpHfA1fgH2czClGt2iDVjU6xmOYJC8hoCK9wBv",
    )

    ADMIN_DEFAULT_PASSWORD = os.getenv("ADMIN_DEFAULT_PASSWORD", "admin12345")
    ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "")

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
    APPOINTMENT_BUFFER_MIN = int(os.getenv("APPOINTMENT_BUFFER_MIN", "0"))
    CALENDAR_REQUIRED = os.getenv("CALENDAR_REQUIRED", "true").lower() == "true"
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
