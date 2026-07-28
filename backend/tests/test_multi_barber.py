import unittest
from datetime import date, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import config, normalize_database_url
from app.controllers.admin_controller import stats
from app.database import Base
from app.models import AppointmentStatus, PromotionType
from app.schemas import (
    AppointmentCancel,
    AppointmentCreate,
    AvailabilityExceptionCreate,
    GalleryItemCreate,
    QuickBlockCreate,
    ReviewCreate,
    WaitlistCreate,
    PasswordChangeIn,
)
from app.services.access_code_service import (
    access_code_hash,
    generate_access_code,
    verify_access_code,
)
from app.services.appointment_service import AppointmentService
from app.services.calendar_service import (
    CR_TZ,
    calendar_embed_url,
    rfc3339_costa_rica,
)
from app.services.password_service import verify_password
from app.services.reminder_service import ReminderService
from app.services.notification_service import NotificationService
from app.services.idempotency_service import (
    decrypt_access_code,
    encrypt_access_code,
    request_fingerprint,
)
from app.services.seed_service import BARBERS, normalized_service_name


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
            appointment_buffer_min=0,
            cancellation_notice_hours=2,
            reschedule_notice_hours=2,
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

    async def test_monthly_stats_are_portable_to_sqlite(self):
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
            async with sessions() as session:
                result = await stats(
                    year=2026,
                    month=7,
                    barber=SimpleNamespace(id=uuid4()),
                    db=session,
                )
        finally:
            await engine.dispose()

        self.assertEqual(result["appointments"], 0)
        self.assertEqual(result["daily_income"], [])

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

    def test_legacy_premium_service_is_renamed(self):
        self.assertEqual(
            normalized_service_name("Corte de Cabello Sebastián", 6000),
            "Corte Premium",
        )
        self.assertEqual(
            normalized_service_name("Corte Sebastian", 6000),
            "Corte Premium",
        )
        self.assertEqual(
            normalized_service_name("Corte de Cabello", 5000),
            "Corte de Cabello",
        )

    def test_sebastian_instagram_username_is_exact(self):
        sebastian = next(
            barber for barber in BARBERS if barber["username"] == "sebas"
        )

        self.assertEqual(
            sebastian["instagram_url"],
            "https://www.instagram.com/__andres29__/",
        )

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

    def test_access_code_is_long_random_and_verifiable(self):
        first = generate_access_code()
        second = generate_access_code()

        self.assertRegex(
            first,
            r"^SB-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$",
        )
        self.assertNotEqual(first, second)
        self.assertTrue(verify_access_code(first.lower(), access_code_hash(first)))
        self.assertFalse(verify_access_code(second, access_code_hash(first)))

    def test_secure_booking_requires_code_instead_of_phone(self):
        code = generate_access_code()
        appointment = SimpleNamespace(
            access_code_hash=access_code_hash(code),
            client_phone="88887777",
        )

        with self.assertRaises(HTTPException) as context:
            self.service.authorize_client(
                appointment,
                phone="88887777",
                access_code=None,
            )

        self.assertEqual(context.exception.status_code, 403)
        self.service.authorize_client(
            appointment,
            phone=None,
            access_code=code,
        )

    def test_cancel_schema_requires_an_access_method(self):
        with self.assertRaises(ValidationError):
            AppointmentCancel(reason="Sin motivo")

        value = AppointmentCancel(
            access_code="SB-ABCD-EFGH-JKLM-NPQR",
            reason="Cambio de planes",
        )
        self.assertIsNone(value.phone)

    def test_engagement_schemas_reject_invalid_content(self):
        with self.assertRaises(ValidationError):
            ReviewCreate(
                access_code="SB-ABCD-EFGH-JKLM-NPQR",
                rating=6,
                comment="Servicio excelente",
            )

        with self.assertRaises(ValidationError):
            WaitlistCreate(
                barber_id=uuid4(),
                service_id=uuid4(),
                desired_date=date(2026, 8, 10),
                client_name="<script>alert(1)</script>",
                client_phone="88887777",
            )

        with self.assertRaises(ValidationError):
            GalleryItemCreate(
                image_url="http://example.com/corte.jpg",
                title="Corte",
                alt_text="Corte con degradado",
                category="Fade",
                description="Corte limpio y definido",
            )

    def test_legacy_statuses_map_to_new_business_states(self):
        self.assertEqual(
            AppointmentStatus("booked"),
            AppointmentStatus.pending,
        )
        self.assertEqual(
            AppointmentStatus("present"),
            AppointmentStatus.completed,
        )
        self.assertEqual(
            AppointmentStatus("noshow"),
            AppointmentStatus.no_show,
        )

    def test_availability_exception_rejects_invalid_ranges(self):
        with self.assertRaises(ValidationError):
            AvailabilityExceptionCreate(
                start_date=date(2026, 8, 10),
                end_date=date(2026, 8, 9),
                title="Vacaciones",
            )

        with self.assertRaises(ValidationError):
            AvailabilityExceptionCreate(
                start_date=date(2026, 8, 10),
                end_date=date(2026, 8, 10),
                all_day=False,
                start_min=600,
                end_min=540,
                title="Diligencia",
            )

    async def test_admin_cannot_change_another_barber_appointment(self):
        appointment = SimpleNamespace(
            id=uuid4(),
            barber_id=uuid4(),
            status=AppointmentStatus.pending,
        )
        self.service.appointments.by_id = AsyncMock(
            return_value=appointment,
        )

        with self.assertRaises(HTTPException) as context:
            await self.service.update_status(
                appointment.id,
                self.gabriel.id,
                AppointmentStatus.confirmed.value,
            )

        self.assertEqual(context.exception.status_code, 403)

    async def test_pending_appointment_can_be_confirmed(self):
        appointment = SimpleNamespace(
            id=uuid4(),
            barber_id=self.gabriel.id,
            status=AppointmentStatus.pending,
            calendar_event_id=None,
        )
        self.service.appointments.by_id = AsyncMock(
            return_value=appointment,
        )
        self.service.barbers.by_id = AsyncMock(return_value=self.gabriel)
        self.service.db.commit = AsyncMock()
        self.service.db.refresh = AsyncMock()
        self.service.audit = MagicMock()

        result = await self.service.update_status(
            appointment.id,
            self.gabriel.id,
            AppointmentStatus.confirmed.value,
        )

        self.assertEqual(result.status, AppointmentStatus.confirmed)
        self.service.audit.record.assert_called_once()

    async def test_quick_block_uses_first_available_slot(self):
        self.service.availability = AsyncMock(
            return_value=[{"start_min": 570, "label": "9:30 a. m."}]
        )
        self.service.create_block = AsyncMock(return_value="bloqueo-creado")

        result = await self.service.create_next_available_block(
            self.gabriel.id,
            QuickBlockCreate(notes="Descanso"),
        )

        self.assertEqual(result, "bloqueo-creado")
        self.service.availability.assert_awaited_once_with(
            self.gabriel.id,
            self.service.availability.call_args.args[1],
            45,
        )
        self.assertEqual(
            self.service.create_block.call_args.args[0],
            self.gabriel.id,
        )
        block = self.service.create_block.call_args.args[1]
        self.assertEqual(block.start_min, 570)
        self.assertEqual(block.end_min, 615)
        self.assertEqual(block.notes, "Descanso")

    async def test_failed_reminder_is_not_marked_as_sent(self):
        service = ReminderService(MagicMock())
        service.notifications.process_due = AsyncMock(
            return_value={
                "enabled": True,
                "processed": 0,
                "skipped": 0,
                "failed": 1,
                "status": "ok",
                "daily_summaries": 0,
                "waitlist_notices": 0,
            }
        )

        summary = await service.process_due()

        self.assertEqual(summary["processed"], 0)
        self.assertEqual(summary["failed"], 1)
        service.notifications.process_due.assert_awaited_once()

    async def test_slot_is_locked_and_rechecked_before_insert(self):
        data = AppointmentCreate(
            barber_id=self.gabriel.id,
            service_id=uuid4(),
            date=date(2026, 7, 28),
            start_min=480,
            client_name="Cliente prueba",
            client_phone="88887777",
        )
        self.service.barbers.by_id = AsyncMock(return_value=self.gabriel)
        self.service.appointments.by_request_id = AsyncMock(return_value=None)
        self.service.get_duration_and_price = AsyncMock(
            return_value=("Corte Premium", [], 45, 6000)
        )
        self.service.promotions.apply = AsyncMock(
            return_value=(6000, 0, None)
        )
        self.service.validate_booking_window = AsyncMock()
        self.service.lock_schedule = AsyncMock()
        self.service.appointments.has_overlap = AsyncMock(return_value=True)
        self.service.db.rollback = AsyncMock()

        with self.assertRaises(HTTPException) as context:
            await self.service.create(data)

        self.assertEqual(context.exception.status_code, 409)
        self.service.lock_schedule.assert_awaited_once_with(
            self.gabriel.id,
            data.date,
        )
        self.assertEqual(
            self.service.validate_booking_window.await_count,
            2,
        )
        self.service.db.rollback.assert_awaited_once()

    def test_idempotency_fingerprint_ignores_request_identifier(self):
        base = {
            "request_id": uuid4(),
            "barber_id": uuid4(),
            "date": date(2026, 8, 1),
            "start_min": 480,
            "website": "",
        }
        repeated = {**base, "request_id": uuid4()}

        self.assertEqual(
            request_fingerprint(base),
            request_fingerprint(repeated),
        )

    def test_access_code_encryption_round_trip(self):
        code = generate_access_code()

        encrypted = encrypt_access_code(code)

        self.assertNotIn(code, encrypted)
        self.assertEqual(decrypt_access_code(encrypted), code)

    def test_password_policy_requires_all_character_groups(self):
        with self.assertRaises(ValidationError):
            PasswordChangeIn(
                current_password="ClaveActual1!",
                new_password="solo-minusculas",
            )

        valid = PasswordChangeIn(
            current_password="ClaveActual1!",
            new_password="NuevaClave2$",
        )
        self.assertEqual(valid.new_password, "NuevaClave2$")

    def test_promotion_type_values_are_stable(self):
        self.assertEqual(PromotionType.percentage.value, "percentage")
        self.assertEqual(PromotionType.fixed.value, "fixed")

    async def test_reminder_uses_client_template_24_hours_before(self):
        code = generate_access_code()
        appointment = SimpleNamespace(
            id=uuid4(),
            client_email="cliente@example.com",
            client_name="Cliente prueba",
            client_phone="88887777",
            service_name="Corte Premium",
            addons=[],
            total_price=6000,
            starts_at=datetime.now(CR_TZ) + timedelta(hours=30),
            ends_at=datetime.now(CR_TZ) + timedelta(hours=30, minutes=45),
            status=AppointmentStatus.pending,
            access_code_encrypted=encrypt_access_code(code),
            notes=None,
        )
        barber = SimpleNamespace(
            id=uuid4(),
            name="Gabriel",
            email="gabriel@example.com",
        )
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db = MagicMock()
        db.execute = AsyncMock(return_value=result)
        db.add = MagicMock()
        service = NotificationService(db)

        with patch.object(config, "EMAILJS_TEMPLATE_CLIENTE", "template_cliente"):
            created = await service.enqueue_reminder(appointment, barber)

        self.assertTrue(created)
        job = db.add.call_args.args[0]
        self.assertEqual(job.template_id, "template_cliente")
        self.assertEqual(job.payload["access_code"], code)
        expected = appointment.starts_at - timedelta(hours=24)
        self.assertLess(abs((job.scheduled_for - expected).total_seconds()), 1)


if __name__ == "__main__":
    unittest.main()
