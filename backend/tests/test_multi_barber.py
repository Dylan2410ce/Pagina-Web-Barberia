import unittest
from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from pydantic import ValidationError

from app.config import normalize_database_url
from app.schemas import AppointmentCreate
from app.services.appointment_service import AppointmentService
from app.services.calendar_service import (
    CR_TZ,
    calendar_embed_url,
    rfc3339_costa_rica,
)
from app.services.password_service import verify_password


class MultiBarberTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.service = AppointmentService(MagicMock())
        self.service.calendar = MagicMock()
        self.service.calendar.is_available.return_value = True
        self.service.calendar.list_busy.return_value = []
        self.service.calendar.create_event.return_value = "evento-gabriel"
        self.gabriel = SimpleNamespace(
            id=uuid4(),
            name="Gabriel",
            calendar_sync=True,
            calendar_id="gabriel@group.calendar.google.com",
        )
        self.start = datetime(2026, 7, 27, 8, 0, tzinfo=CR_TZ)
        self.end = datetime(2026, 7, 27, 8, 45, tzinfo=CR_TZ)

    async def test_gabriel_reads_only_his_google_calendar(self):
        busy = await self.service._calendar_busy(self.gabriel, self.start, self.end)

        self.assertEqual(busy, [])
        self.service.calendar.is_available.assert_called_once_with(
            self.gabriel.calendar_id
        )
        self.service.calendar.list_busy.assert_called_once_with(
            self.gabriel.calendar_id,
            self.start,
            self.end,
        )

    async def test_gabriel_creates_event_in_his_calendar(self):
        appointment = SimpleNamespace()

        event_id = await self.service._create_calendar_event(
            self.gabriel,
            appointment,
        )

        self.assertEqual(event_id, "evento-gabriel")
        self.service.calendar.create_event.assert_called_once_with(
            self.gabriel.calendar_id,
            appointment,
        )

    def test_neon_url_uses_asyncpg_without_libpq_parameters(self):
        value = (
            "postgresql://user:pass@host/neondb"
            "?sslmode=require&channel_binding=require"
        )

        normalized = normalize_database_url(value)

        self.assertEqual(normalized, "postgresql+asyncpg://user:pass@host/neondb")

    def test_calendar_timestamp_is_rfc3339_costa_rica(self):
        self.assertEqual(
            rfc3339_costa_rica(self.start),
            "2026-07-27T08:00:00-06:00",
        )

    def test_calendar_embed_uses_costa_rica_timezone(self):
        url = calendar_embed_url("gabriel@group.calendar.google.com")

        self.assertIn("ctz=America%2FCosta_Rica", url)
        self.assertIn("src=gabriel%40group.calendar.google.com", url)

    def test_booking_schema_rejects_unknown_fields_and_bad_phone(self):
        with self.assertRaises(ValidationError):
            AppointmentCreate(
                barber_id=uuid4(),
                service_id=uuid4(),
                date=date(2026, 7, 27),
                start_min=480,
                client_name="Cliente prueba",
                client_phone="123",
                unexpected=True,
            )

    def test_unconfigured_account_cannot_authenticate(self):
        self.assertFalse(verify_password("cualquier-clave", "unconfigured"))

    def test_booking_schema_rejects_html_input(self):
        with self.assertRaises(ValidationError):
            AppointmentCreate(
                barber_id=uuid4(),
                service_id=uuid4(),
                date=date(2026, 7, 27),
                start_min=480,
                client_name="<script>alert(1)</script>",
                client_phone="88887777",
            )


if __name__ == "__main__":
    unittest.main()
