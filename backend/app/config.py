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
