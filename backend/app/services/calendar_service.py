import json
import logging
from datetime import datetime, timedelta, timezone
from functools import cached_property
from zoneinfo import ZoneInfo

from app.config import config

logger = logging.getLogger("sebas_barber.calendar")

try:
    CR_TZ = ZoneInfo("America/Costa_Rica")
except Exception:
    CR_TZ = timezone(timedelta(hours=-6), name="America/Costa_Rica")


def parse_calendar_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def rfc3339_costa_rica(value: datetime) -> str:
    return value.astimezone(CR_TZ).isoformat(timespec="seconds")


def log_google_error(context: str, exc: Exception) -> None:
    status = getattr(getattr(exc, "resp", None), "status", None)
    reason = getattr(getattr(exc, "resp", None), "reason", None)
    content = getattr(exc, "content", None)
    if isinstance(content, bytes):
        content = content.decode("utf-8", errors="replace")
    logger.exception(
        "Google Calendar: %s | status=%s reason=%s content=%s error=%s",
        context,
        status,
        reason,
        content,
        exc,
    )


class CalendarError(Exception):
    pass


class CalendarService:
    def __init__(self):
        self.enabled = config.CALENDAR_ENABLED and bool(config.GOOGLE_CALENDAR_ID)

    @cached_property
    def service(self):
        if not self.enabled:
            return None

        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
        except Exception as exc:
            logger.exception("Google Calendar: no se pudieron importar dependencias: %s", exc)
            return None

        scopes = ["https://www.googleapis.com/auth/calendar"]
        credentials = None

        try:
            if config.GOOGLE_CREDENTIALS_JSON:
                credentials = service_account.Credentials.from_service_account_info(
                    json.loads(config.GOOGLE_CREDENTIALS_JSON),
                    scopes=scopes,
                )
            elif config.GOOGLE_CREDENTIALS_FILE:
                credentials = service_account.Credentials.from_service_account_file(
                    config.GOOGLE_CREDENTIALS_FILE,
                    scopes=scopes,
                )
        except Exception as exc:
            logger.exception("Google Calendar: credenciales invalidas o mal formateadas: %s", exc)
            return None

        if not credentials:
            logger.warning("Google Calendar: no hay credenciales configuradas")
            return None

        try:
            return build("calendar", "v3", credentials=credentials, cache_discovery=False)
        except Exception as exc:
            logger.exception("Google Calendar: no se pudo crear el cliente: %s", exc)
            return None

    def is_available(self) -> bool:
        return self.service is not None

    def list_busy(self, start: datetime, end: datetime) -> list[dict]:
        if not self.service:
            logger.warning("Google Calendar: list_busy omitido porque el cliente no esta disponible")
            return []

        try:
            response = (
                self.service.events()
                .list(
                    calendarId=config.GOOGLE_CALENDAR_ID,
                    timeMin=rfc3339_costa_rica(start),
                    timeMax=rfc3339_costa_rica(end),
                    timeZone="America/Costa_Rica",
                    singleEvents=True,
                    orderBy="startTime",
                )
                .execute()
            )
        except Exception as exc:
            log_google_error("error leyendo eventos ocupados", exc)
            return []

        busy = []
        for event in response.get("items", []):
            if event.get("status") == "cancelled":
                continue
            event_start = event.get("start", {}).get("dateTime")
            event_end = event.get("end", {}).get("dateTime")
            if event_start and event_end:
                busy.append({"id": event.get("id"), "start": event_start, "end": event_end})
        return busy

    def has_overlap(self, start: datetime, end: datetime, ignore_event_id: str | None = None) -> bool:
        busy = self.list_busy(start, end)
        return any(
            item["id"] != ignore_event_id
            and start < parse_calendar_datetime(item["end"])
            and end > parse_calendar_datetime(item["start"])
            for item in busy
        )

    def create_event(self, appointment) -> str | None:
        if not self.service:
            logger.warning("Google Calendar: create_event omitido porque el cliente no esta disponible")
            if self.enabled and config.CALENDAR_REQUIRED:
                raise CalendarError("Google Calendar no esta disponible. Revisa credenciales en Render.")
            return None

        event = {
            "summary": f"{appointment.service_name} - {appointment.client_name}",
            "description": (
                f"Cliente: {appointment.client_name}\n"
                f"Telefono: {appointment.client_phone}\n"
                f"Servicio: {appointment.service_name}\n"
                f"Precio: {appointment.total_price}\n"
                f"Notas: {appointment.notes or ''}"
            ),
            "start": {"dateTime": rfc3339_costa_rica(appointment.starts_at), "timeZone": "America/Costa_Rica"},
            "end": {"dateTime": rfc3339_costa_rica(appointment.ends_at), "timeZone": "America/Costa_Rica"},
        }
        try:
            logger.info(
                "Google Calendar: creando evento calendarId=%s start=%s end=%s",
                config.GOOGLE_CALENDAR_ID,
                event["start"]["dateTime"],
                event["end"]["dateTime"],
            )
            created = (
                self.service.events()
                .insert(
                    calendarId=config.GOOGLE_CALENDAR_ID,
                    body=event,
                    sendUpdates="none",
                )
                .execute()
            )
            return created.get("id")
        except Exception as exc:
            log_google_error("error creando evento", exc)
            if config.CALENDAR_REQUIRED:
                raise CalendarError("Google Calendar rechazo el evento. Revisa los logs de Render.") from exc
            return None

    def delete_event(self, event_id: str | None) -> None:
        if not self.service or not event_id:
            return
        try:
            self.service.events().delete(calendarId=config.GOOGLE_CALENDAR_ID, eventId=event_id, sendUpdates="all").execute()
        except Exception as exc:
            log_google_error(f"error eliminando evento {event_id}", exc)
