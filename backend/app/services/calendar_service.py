import json
from datetime import datetime
from functools import cached_property

from app.config import config


def parse_calendar_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


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
        except Exception:
            return None

        scopes = ["https://www.googleapis.com/auth/calendar"]
        credentials = None

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

        if not credentials:
            return None

        return build("calendar", "v3", credentials=credentials, cache_discovery=False)

    def is_available(self) -> bool:
        return self.service is not None

    def list_busy(self, start: datetime, end: datetime) -> list[dict]:
        if not self.service:
            return []

        response = (
            self.service.events()
            .list(
                calendarId=config.GOOGLE_CALENDAR_ID,
                timeMin=start.isoformat(),
                timeMax=end.isoformat(),
                singleEvents=True,
                orderBy="startTime",
            )
            .execute()
        )

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
            return None

        attendees = []
        if appointment.client_email:
            attendees.append({"email": appointment.client_email})
        if config.OWNER_EMAIL:
            attendees.append({"email": config.OWNER_EMAIL})

        event = {
            "summary": f"{appointment.service_name} - {appointment.client_name}",
            "description": (
                f"Cliente: {appointment.client_name}\n"
                f"Telefono: {appointment.client_phone}\n"
                f"Servicio: {appointment.service_name}\n"
                f"Precio: {appointment.total_price}\n"
                f"Notas: {appointment.notes or ''}"
            ),
            "start": {"dateTime": appointment.starts_at.isoformat(), "timeZone": "America/Costa_Rica"},
            "end": {"dateTime": appointment.ends_at.isoformat(), "timeZone": "America/Costa_Rica"},
            "attendees": attendees,
        }
        created = (
            self.service.events()
            .insert(
                calendarId=config.GOOGLE_CALENDAR_ID,
                body=event,
                sendUpdates="all" if attendees else "none",
            )
            .execute()
        )
        return created.get("id")

    def delete_event(self, event_id: str | None) -> None:
        if not self.service or not event_id:
            return
        self.service.events().delete(calendarId=config.GOOGLE_CALENDAR_ID, eventId=event_id, sendUpdates="all").execute()
