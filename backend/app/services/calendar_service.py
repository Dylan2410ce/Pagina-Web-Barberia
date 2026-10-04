import base64
import glob
import hashlib
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
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("La fecha debe incluir una zona horaria")
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


def google_error_details(exc: Exception) -> tuple[int | None, str]:
    status = getattr(getattr(exc, "resp", None), "status", None)
    reason = "unknown"
    allowed = {"authError", "forbidden", "notFound", "duplicate", "deleted", "badRequest",
               "rateLimitExceeded", "userRateLimitExceeded", "backendError", "accessNotConfigured"}
    try:
        error = json.loads(getattr(exc, "content", b"{}"))["error"]
        candidate = next((item.get("reason") for item in error.get("errors", []) if item.get("reason") in allowed), None)
        reason = candidate or reason
    except (ValueError, TypeError, KeyError, AttributeError):
        pass
    return status, reason


def log_google_error(context: str, exc: Exception) -> None:
    status, reason = google_error_details(exc)
    logger.error("Google Calendar: %s | status=%s reason=%s tipo=%s", context, status, reason, type(exc).__name__)


def calendar_failure(exc: Exception) -> "CalendarError":
    status, reason = google_error_details(exc)
    messages = {
        400: "Google Calendar rechazó los datos del evento. Revisa su configuración.",
        401: "Google Calendar no pudo autenticar la cuenta de servicio.",
        403: "Google Calendar rechazó la operación. Revisa los permisos y los límites de la API.",
        404: "El calendario no existe o no está compartido con la cuenta de servicio.",
        429: "Google Calendar alcanzó su límite temporal. Intenta nuevamente en unos minutos.",
    }
    return CalendarError(messages.get(status, "Google Calendar no confirmó la operación. Intenta nuevamente."), status=status, reason=reason)


class CalendarError(Exception):
    def __init__(self, message: str, *, status: int | None = None, reason: str = "unavailable"):
        super().__init__(message)
        self.status = status
        self.reason = reason


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
            from google_auth_httplib2 import AuthorizedHttp
            from httplib2 import Http
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
            return build("calendar", "v3", http=AuthorizedHttp(credentials, http=Http(timeout=10)), cache_discovery=False)
        except Exception as exc:
            log_google_error("cliente no disponible", exc)
            return None

    def is_available(self, calendar_id: str | None = None) -> bool:
        return bool(self.enabled and calendar_id and self.service)

    def check_access(self, calendar_id: str | None) -> dict:
        """Comprueba lectura real sin crear eventos ni modificar la agenda."""
        if not self.is_available(calendar_id):
            return {"available": False, "read_access": False, "write_access": "not_verified", "reason": "unavailable"}
        try:
            self.service.events().list(calendarId=calendar_id, maxResults=1, fields="items(id)", timeZone="America/Costa_Rica").execute(num_retries=1)
            return {"available": True, "read_access": True, "write_access": "not_verified", "reason": "ok"}
        except Exception as exc:
            log_google_error("diagnóstico de permisos", exc)
            status, reason = google_error_details(exc)
            return {"available": False, "read_access": False, "write_access": "not_verified", "status": status, "reason": reason, "message": str(calendar_failure(exc))}

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
                ).execute(num_retries=1)
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
                raise calendar_failure(exc) from exc
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

        start = rfc3339_costa_rica(appointment.starts_at)
        end = rfc3339_costa_rica(appointment.ends_at)
        if appointment.ends_at <= appointment.starts_at:
            raise CalendarError("La hora final debe ser posterior a la hora inicial.")
        event_id = "sb" + hashlib.sha256(f"{appointment.id}|{start}|{end}".encode()).hexdigest()
        event = {
            "id": event_id,
            "extendedProperties": {"private": {"appointment_id": str(appointment.id), "source": "sebas-barber"}},
            "location": config.ADDRESS,
            "summary": f"{appointment.service_name} - {appointment.client_name}",
            "description": (
                f"Cliente: {appointment.client_name}\n"
                f"Teléfono: {appointment.client_phone}\n"
                f"Servicio: {appointment.service_name}\n"
                f"Precio: {appointment.total_price}\n"
                f"Notas: {appointment.notes or ''}"
            ),
            "start": {"dateTime": start, "timeZone": "America/Costa_Rica"},
            "end": {"dateTime": end, "timeZone": "America/Costa_Rica"},
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
                .execute(num_retries=1)
            )
            if not created.get("id"):
                raise CalendarError("Google Calendar no devolvió el identificador del evento.")
            logger.info("Google Calendar: evento confirmado")
            return created["id"]
        except Exception as exc:
            status, _ = google_error_details(exc)
            # Un ID estable permite recuperar una inserción cuya respuesta se perdió.
            if status == 409 or status is None or status >= 500:
                try:
                    existing = self.service.events().get(calendarId=calendar_id, eventId=event_id).execute(num_retries=1)
                    if (existing.get("status") != "cancelled"
                        and existing.get("extendedProperties", {}).get("private", {}).get("appointment_id") == str(appointment.id)
                        and parse_calendar_datetime(existing["start"]["dateTime"]) == appointment.starts_at
                        and parse_calendar_datetime(existing["end"]["dateTime"]) == appointment.ends_at):
                        logger.info("Google Calendar: inserción recuperada sin duplicar el evento")
                        return event_id
                except Exception as recovery_error:
                    log_google_error("recuperación de inserción", recovery_error)
            log_google_error("error creando evento", exc)
            if config.CALENDAR_REQUIRED:
                raise calendar_failure(exc) from exc
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
            ).execute(num_retries=1)
        except Exception as exc:
            status = getattr(getattr(exc, "resp", None), "status", None)
            if status in {404, 410}:
                return
            log_google_error("error eliminando evento", exc)
            if config.CALENDAR_REQUIRED:
                raise calendar_failure(exc) from exc
