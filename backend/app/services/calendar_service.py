import base64
import glob
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from functools import cached_property
from urllib.parse import urlencode
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


def calendar_embed_url(calendar_id: str | None) -> str | None:
    if not calendar_id:
        return None
    query = urlencode(
        {
            "src": calendar_id,
            "ctz": "America/Costa_Rica",
            "mode": "WEEK",
        }
    )
    return f"https://calendar.google.com/calendar/embed?{query}"


def log_google_error(context: str, exc: Exception) -> None:
    status = getattr(getattr(exc, "resp", None), "status", None)
    logger.error("Google Calendar: %s | status=%s tipo=%s", context, status, type(exc).__name__)


class CalendarError(Exception):
    pass


class CalendarService:
    def __init__(self):
        self.enabled = config.CALENDAR_ENABLED
        self.credential_source = "none"

    def _credentials_from_secret_file(self, service_account, scopes):
        candidates = []
        explicit_paths = [
            config.GOOGLE_CREDENTIALS_FILE,
            config.GOOGLE_APPLICATION_CREDENTIALS,
            "/etc/secrets/barberiasebas-65af4656c417.json",
            "/etc/secrets/google-credentials.json",
            "/etc/secrets/google-calendar.json",
            "/etc/secrets/service-account.json",
        ]

        candidates.extend([path for path in explicit_paths if path])
        candidates.extend(glob.glob("/etc/secrets/*.json"))

        seen = set()
        for path in candidates:
            if not path or path in seen or not os.path.exists(path):
                continue
            seen.add(path)
            try:
                with open(path, "r", encoding="utf-8") as file:
                    payload = json.load(file)
                if payload.get("type") == "service_account" and payload.get("client_email"):
                    self.credential_source = f"file:{path}"
                    return service_account.Credentials.from_service_account_info(payload, scopes=scopes)
            except Exception as exc:
                logger.warning("Google Calendar: credencial no legible (%s)", type(exc).__name__)
        return None

    @cached_property
    def service(self):
        if not self.enabled:
            return None

        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
        except Exception as exc:
            log_google_error("dependencias no disponibles", exc)
            return None

        scopes = ["https://www.googleapis.com/auth/calendar"]
        credentials = None

        try:
            raw_json = config.GOOGLE_CREDENTIALS_JSON or config.GOOGLE_SERVICE_ACCOUNT_JSON
            if config.GOOGLE_CREDENTIALS_B64:
                raw_json = base64.b64decode(config.GOOGLE_CREDENTIALS_B64).decode("utf-8")

            if raw_json:
                self.credential_source = "env-json"
                credentials = service_account.Credentials.from_service_account_info(
                    json.loads(raw_json),
                    scopes=scopes,
                )
            else:
                credentials = self._credentials_from_secret_file(service_account, scopes)
        except Exception as exc:
            log_google_error("credenciales inválidas", exc)
            return None

        if not credentials:
            logger.warning(
                "Google Calendar: no hay credenciales configuradas. Usa GOOGLE_CREDENTIALS_JSON, "
                "GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_CREDENTIALS_B64, GOOGLE_CREDENTIALS_FILE, "
                "GOOGLE_APPLICATION_CREDENTIALS o un Secret File JSON en /etc/secrets."
            )
            return None

        try:
            return build("calendar", "v3", credentials=credentials, cache_discovery=False)
        except Exception as exc:
            log_google_error("cliente no disponible", exc)
            return None

    def is_available(self, calendar_id: str | None = None) -> bool:
        return bool(self.enabled and calendar_id and self.service)

    def list_busy(
        self,
        calendar_id: str,
        start: datetime,
        end: datetime,
    ) -> list[dict]:
        if not self.is_available(calendar_id):
            message = "Google Calendar no está disponible para esta agenda."
            logger.warning("%s calendar_id_configured=%s", message, bool(calendar_id))
            if config.CALENDAR_REQUIRED:
                raise CalendarError(message)
            return []

        try:
            busy = []
            page_token = None
            while True:
                response = self.service.events().list(
                    calendarId=calendar_id, timeMin=rfc3339_costa_rica(start),
                    timeMax=rfc3339_costa_rica(end), timeZone="America/Costa_Rica",
                    singleEvents=True, orderBy="startTime", maxResults=2500,
                    pageToken=page_token,
                ).execute()
                for event in response.get("items", []):
                    if event.get("status") == "cancelled" or event.get("transparency") == "transparent":
                        continue
                    bounds = []
                    for field in ("start", "end"):
                        value = event.get(field, {})
                        if value.get("dateTime"):
                            bounds.append(rfc3339_costa_rica(parse_calendar_datetime(value["dateTime"])))
                        elif value.get("date"):
                            bounds.append(datetime.fromisoformat(value["date"]).replace(tzinfo=CR_TZ).isoformat())
                        else:
                            raise ValueError("Evento sin horario verificable")
                    busy.append({"id": event.get("id"), "start": bounds[0], "end": bounds[1]})
                page_token = response.get("nextPageToken")
                if not page_token:
                    return busy
        except Exception as exc:
            log_google_error("error leyendo eventos ocupados", exc)
            if config.CALENDAR_REQUIRED:
                raise CalendarError("No pudimos verificar Google Calendar en este momento.") from exc
            return []

    def has_overlap(
        self,
        calendar_id: str,
        start: datetime,
        end: datetime,
        ignore_event_id: str | None = None,
    ) -> bool:
        busy = self.list_busy(calendar_id, start, end)
        return any(
            item["id"] != ignore_event_id
            and start < parse_calendar_datetime(item["end"])
            and end > parse_calendar_datetime(item["start"])
            for item in busy
        )

    def create_event(self, calendar_id: str, appointment) -> str | None:
        if not self.is_available(calendar_id):
            logger.warning(
                "Google Calendar: create_event omitido. calendar_id_configured=%s",
                bool(calendar_id),
            )
            if self.enabled and config.CALENDAR_REQUIRED:
                raise CalendarError(
                    "Google Calendar no está disponible para esta agenda."
                )
            return None

        event = {
            "summary": f"{appointment.service_name} - {appointment.client_name}",
            "description": (
                f"Cliente: {appointment.client_name}\n"
                f"Teléfono: {appointment.client_phone}\n"
                f"Servicio: {appointment.service_name}\n"
                f"Precio: {appointment.total_price}\n"
                f"Notas: {appointment.notes or ''}"
            ),
            "start": {"dateTime": rfc3339_costa_rica(appointment.starts_at), "timeZone": "America/Costa_Rica"},
            "end": {"dateTime": rfc3339_costa_rica(appointment.ends_at), "timeZone": "America/Costa_Rica"},
        }
        try:
            logger.info("Google Calendar: creando evento")
            created = (
                self.service.events()
                .insert(
                    calendarId=calendar_id,
                    body=event,
                    sendUpdates="none",
                )
                .execute()
            )
            return created.get("id")
        except Exception as exc:
            log_google_error("error creando evento", exc)
            if config.CALENDAR_REQUIRED:
                raise CalendarError("No pudimos confirmar el horario. Intenta nuevamente.") from exc
            return None

    def delete_event(self, calendar_id: str, event_id: str | None) -> None:
        if not event_id:
            return
        if not self.is_available(calendar_id):
            logger.warning(
                "Google Calendar: delete_event omitido. calendar_id_configured=%s",
                bool(calendar_id),
            )
            if self.enabled and config.CALENDAR_REQUIRED:
                raise CalendarError(
                    "Google Calendar no está disponible para esta agenda."
                )
            return
        try:
            self.service.events().delete(
                calendarId=calendar_id,
                eventId=event_id,
                sendUpdates="none",
            ).execute()
        except Exception as exc:
            status = getattr(getattr(exc, "resp", None), "status", None)
            if status == 404:
                return
            log_google_error("error eliminando evento", exc)
            if config.CALENDAR_REQUIRED:
                raise CalendarError(
                    "Google Calendar no pudo eliminar el evento."
                ) from exc
