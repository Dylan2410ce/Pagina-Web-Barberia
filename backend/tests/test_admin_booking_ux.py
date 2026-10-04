import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError

from app.controllers.admin_controller import create_manual_appointment, preview_block
from app.schemas import AppointmentCreate, BlockPreview


class AdminBookingTests(unittest.IsolatedAsyncioTestCase):
    def payload(self, barber_id):
        return AppointmentCreate(
            barber_id=barber_id, service_id=uuid4(), date=date(2026, 10, 6),
            start_min=480, client_name="Cliente de prueba", client_phone="88887777",
        )

    async def test_manual_booking_rejects_other_barber(self):
        with patch("app.controllers.admin_controller.AppointmentService") as service:
            with self.assertRaises(HTTPException) as raised:
                await create_manual_appointment(self.payload(uuid4()), SimpleNamespace(id=uuid4()), MagicMock())
            self.assertEqual(raised.exception.status_code, 403)
            service.assert_not_called()

    async def test_manual_booking_reuses_transactional_booking_service(self):
        barber = SimpleNamespace(id=uuid4())
        payload = self.payload(barber.id)
        with patch("app.controllers.admin_controller.AppointmentService") as service:
            service.return_value.create = AsyncMock(return_value="created")
            result = await create_manual_appointment(payload, barber, MagicMock())
            self.assertEqual(result, "created")
            service.return_value.create.assert_awaited_once_with(payload, actor="barber")

    async def test_preview_filters_by_authenticated_barber_and_time(self):
        barber = SimpleNamespace(id=uuid4())
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        db = SimpleNamespace(scalar=AsyncMock(return_value=0), execute=AsyncMock(return_value=result))
        preview = await preview_block(BlockPreview(start_date=date(2026, 10, 6), end_date=date(2026, 10, 6)), barber, db)
        self.assertEqual(preview, {"total": 0, "appointments": []})
        for statement in [db.scalar.call_args.args[0], db.execute.call_args.args[0]]:
            params = statement.compile().params
            self.assertIn(barber.id, params.values())
            self.assertIn("starts_at", str(statement))
            self.assertIn("ends_at", str(statement))

    def test_preview_rejects_reversed_or_excessive_periods(self):
        for end in [date(2026, 10, 5), date(2028, 10, 6)]:
            with self.assertRaises(ValidationError):
                BlockPreview(start_date=date(2026, 10, 6), end_date=end)
        with self.assertRaises(ValidationError):
            BlockPreview(start_date=date(2026, 10, 6), end_date=date(2026, 10, 6), all_day=False, start_min=600, end_min=500)
