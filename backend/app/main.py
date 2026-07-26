import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import config
from app.controllers import admin_controller, public_controller
from app.database import AsyncSessionLocal, engine, init_db
from app.routers import bookings
from app.services.calendar_service import CalendarService
from app.services.seed_service import seed_data

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
logger = logging.getLogger("sebas_barber.api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if config.MISSING_SECURITY_ENV:
        logger.warning(
            "Faltan variables de seguridad; se usaron valores aleatorios de cierre seguro: %s",
            ", ".join(config.MISSING_SECURITY_ENV),
        )
    await init_db()
    async with AsyncSessionLocal() as db:
        await seed_data(db)
    yield
    await engine.dispose()


app = FastAPI(title="Sebas Barber API", version="2.0.0", lifespan=lifespan)

allowed_origins = {
    config.FRONTEND_URL.rstrip("/"),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(allowed_origins),
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


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
            "field": ".".join(
                str(part)
                for part in error["loc"]
                if part not in {"body", "query"}
            ),
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
                "message": "La agenda está despertando. Intenta de nuevo en unos segundos.",
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
app.include_router(bookings.router)
app.include_router(admin_controller.router)


@app.get("/")
async def root():
    return {"app": "Sebas Barber API", "status": "online"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/calendar")
async def calendar_health():
    calendar = CalendarService()
    sebastian_available = await asyncio.to_thread(
        calendar.is_available,
        config.GOOGLE_CALENDAR_SEBASTIAN_ID,
    )
    gabriel_available = await asyncio.to_thread(
        calendar.is_available,
        config.GOOGLE_CALENDAR_GABRIEL_ID,
    )
    return {
        "enabled": calendar.enabled,
        "credentials_configured": bool(
            config.GOOGLE_CREDENTIALS_JSON
            or config.GOOGLE_SERVICE_ACCOUNT_JSON
            or config.GOOGLE_CREDENTIALS_B64
            or config.GOOGLE_CREDENTIALS_FILE
            or config.GOOGLE_APPLICATION_CREDENTIALS
            or calendar.credential_source != "none"
        ),
        "credential_source": calendar.credential_source,
        "client_available": bool(sebastian_available and gabriel_available),
        "required": config.CALENDAR_REQUIRED,
        "timezone": "America/Costa_Rica",
        "profiles": {
            "sebastian": {
                "provider": "google_calendar",
                "calendar_id_configured": bool(
                    config.GOOGLE_CALENDAR_SEBASTIAN_ID
                ),
                "available": sebastian_available,
            },
            "gabriel": {
                "provider": "google_calendar",
                "calendar_id_configured": bool(
                    config.GOOGLE_CALENDAR_GABRIEL_ID
                ),
                "available": gabriel_available,
            },
        },
    }
