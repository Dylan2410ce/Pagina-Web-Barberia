import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import config
from app.controllers import admin_controller, public_controller
from app.database import SessionLocal, init_db
from app.services.calendar_service import CalendarService
from app.services.seed_service import seed_data

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")

app = FastAPI(title="Sebas Barber API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        config.FRONTEND_URL,
        "https://barberiasebas.netlify.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public_controller.router)
app.include_router(admin_controller.router)


@app.on_event("startup")
def startup():
    init_db()
    db = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()


@app.get("/")
def root():
    return {"app": "Sebas Barber API", "status": "online"}


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/health/calendar")
def calendar_health():
    calendar = CalendarService()
    return {
        "enabled": calendar.enabled,
        "calendar_id_configured": bool(config.GOOGLE_CALENDAR_ID),
        "credentials_configured": bool(config.GOOGLE_CREDENTIALS_JSON or config.GOOGLE_CREDENTIALS_FILE),
        "client_available": calendar.is_available(),
        "timezone": "America/Costa_Rica",
    }
