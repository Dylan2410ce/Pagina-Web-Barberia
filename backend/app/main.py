import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import config
from app.controllers import admin_controller, public_controller
from app.database import SessionLocal, init_db
from app.services.calendar_service import CalendarService
from app.services.seed_service import seed_data

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
logger = logging.getLogger("sebas_barber.api")

app = FastAPI(title="Sebas Barber API", version="1.0.0")

allowed_origins = {
    config.FRONTEND_URL.rstrip("/"),
    "https://sebasbarber.netlify.app",
    "https://barberiasebas.netlify.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(allowed_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_: Request, exc: StarletteHTTPException):
    message = exc.detail if isinstance(exc.detail, str) else "La solicitud fue rechazada"
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": "http_error",
                "message": message,
                "details": None if isinstance(exc.detail, str) else exc.detail,
            }
        },
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    details = [
        {
            "field": ".".join(str(part) for part in error["loc"] if part not in {"body", "query"}),
            "message": error["msg"],
            "type": error["type"],
        }
        for error in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "validation_error",
                "message": "Revisa los datos enviados",
                "details": details,
            }
        },
    )


@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.exception("Error de base de datos en %s", request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=503,
        content={
            "error": {
                "code": "database_unavailable",
                "message": "La agenda esta despertando. Intenta de nuevo en unos segundos.",
                "details": None,
            }
        },
    )


@app.exception_handler(Exception)
async def unexpected_exception_handler(request: Request, exc: Exception):
    logger.exception("Error no controlado en %s", request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "No pudimos completar la solicitud.",
                "details": None,
            }
        },
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
    return {"status": "ok"}


@app.get("/health/calendar")
def calendar_health():
    calendar = CalendarService()
    client_available = calendar.is_available()
    return {
        "enabled": calendar.enabled,
        "calendar_id_configured": bool(config.GOOGLE_CALENDAR_ID),
        "credentials_configured": bool(
            config.GOOGLE_CREDENTIALS_JSON
            or config.GOOGLE_SERVICE_ACCOUNT_JSON
            or config.GOOGLE_CREDENTIALS_B64
            or config.GOOGLE_CREDENTIALS_FILE
            or config.GOOGLE_APPLICATION_CREDENTIALS
            or calendar.credential_source != "none"
        ),
        "credential_source": calendar.credential_source,
        "client_available": client_available,
        "required": config.CALENDAR_REQUIRED,
        "timezone": "America/Costa_Rica",
    }
