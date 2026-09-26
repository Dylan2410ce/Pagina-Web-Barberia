import asyncio
import os
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.requests import Request

from app.config import config
from app.database import Base, get_db, required_schema_revisions
from app.main import app
from app.models import Appointment, AppointmentStatus, Barber, DispatchLease, NotificationBudget, NotificationDelivery, NotificationKind, NotificationStatus
from app.services.calendar_service import CalendarService, log_google_error
from app.services.delivery_dispatcher import acquire_lease, reserve_budget
from app.services.emailjs_service import EmailJSError, EmailJSService
from app.services.notification_service import NotificationService
from app.services.rate_limit_service import RateLimiter, client_address
from app.services.shop_status_service import ShopStatusService


def request(path="/api/public/appointments", peer="203.0.113.9", forwarded=""):
    return Request({"type": "http", "method": "POST", "path": path,
                    "headers": [(b"x-forwarded-for", forwarded.encode())],
                    "client": (peer, 1234), "query_string": b""})


class DeliveryTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False, autoflush=False)
        async with self.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        self.barber_id = uuid4()
        async with self.sessions() as db:
            db.add(Barber(id=self.barber_id, name="Prueba", role="Barbero", phone="88887777",
                          username="prueba", password_hash="disabled"))
            await db.commit()

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def enqueue(self, status=NotificationStatus.pending):
        async with self.sessions() as db:
            job = NotificationDelivery(
                barber_id=self.barber_id, kind=NotificationKind.appointment_created,
                status=status, dedupe_key=str(uuid4()), recipient_email="test@example.com",
                template_id="template_prueba", payload={"to_email": "test@example.com"},
                scheduled_for=datetime.now(timezone.utc) - timedelta(minutes=5),
                claimed_at=datetime.now(timezone.utc) - timedelta(minutes=5) if status == NotificationStatus.processing else None,
            )
            db.add(job)
            await db.commit()
            return job.id

    async def dispatch(self, send):
        async with self.sessions() as db:
            service = NotificationService(db)
            service.emailjs = SimpleNamespace(available=lambda: True, send=send)
            with patch.object(config, "REMINDERS_ENABLED", False), patch.object(config, "DAILY_SUMMARIES_ENABLED", False):
                return await service.process_due()

    async def test_rate_limit_survives_new_limiter_instance(self):
        for _ in range(3):
            self.assertTrue((await RateLimiter(self.sessions).check(request()))[0])
        restarted = RateLimiter(self.sessions)
        for _ in range(3):
            self.assertTrue((await restarted.check(request()))[0])
        self.assertFalse((await restarted.check(request()))[0])

    async def test_only_one_dispatcher_claims_lease_and_expired_lease_recovers(self):
        async with self.sessions() as first, self.sessions() as second:
            self.assertTrue(await acquire_lease(first, "first"))
            self.assertFalse(await acquire_lease(second, "second"))
            await first.execute(update(DispatchLease).values(expires_at=datetime.now(timezone.utc) - timedelta(seconds=1)))
            await first.commit()
            self.assertTrue(await acquire_lease(second, "second"))

    async def test_budget_is_shared_and_durable(self):
        with patch.object(config, "EMAIL_MONTHLY_LIMIT", 2):
            for expected in (True, True, False):
                async with self.sessions() as db:
                    self.assertEqual(await reserve_budget(db), expected)
                    await db.commit()
            async with self.sessions() as db:
                self.assertEqual((await db.execute(select(NotificationBudget.attempts))).scalar_one(), 2)

    async def test_sent_delivery_is_not_sent_again(self):
        await self.enqueue()
        send = MagicMock()
        self.assertEqual((await self.dispatch(send))["processed"], 1)
        self.assertEqual((await self.dispatch(send))["processed"], 0)
        send.assert_called_once()

    async def test_interrupted_processing_becomes_uncertain_without_resend(self):
        job_id = await self.enqueue(NotificationStatus.processing)
        send = MagicMock()
        await self.dispatch(send)
        send.assert_not_called()
        async with self.sessions() as db:
            self.assertEqual((await db.get(NotificationDelivery, job_id)).status, NotificationStatus.uncertain)

    async def test_timeout_does_not_retry_ambiguous_email(self):
        job_id = await self.enqueue()
        send = MagicMock(side_effect=EmailJSError("Sin confirmación", uncertain=True))
        self.assertEqual((await self.dispatch(send))["uncertain"], 1)
        await self.dispatch(send)
        send.assert_called_once()
        async with self.sessions() as db:
            self.assertEqual((await db.get(NotificationDelivery, job_id)).status, NotificationStatus.uncertain)

    async def test_rejected_rate_limited_email_remains_retryable(self):
        job_id = await self.enqueue()
        await self.dispatch(MagicMock(side_effect=EmailJSError("HTTP 429", retryable=True)))
        async with self.sessions() as db:
            job = await db.get(NotificationDelivery, job_id)
            self.assertEqual(job.status, NotificationStatus.failed)
            self.assertEqual(job.attempts, 1)

    async def test_notification_rollback_does_not_send_or_persist(self):
        async with self.sessions() as db:
            db.add(NotificationDelivery(
                barber_id=self.barber_id, kind=NotificationKind.appointment_created,
                dedupe_key="rolled-back", recipient_email="test@example.com", template_id="test",
                payload={}, scheduled_for=datetime.now(timezone.utc),
            ))
            await db.flush()
            await db.rollback()
        send = MagicMock()
        await self.dispatch(send)
        send.assert_not_called()


class SecurityTests(unittest.IsolatedAsyncioTestCase):
    def test_next_open_label_uses_costa_rica_not_utc(self):
        value = datetime(2026, 9, 25, 14, tzinfo=timezone.utc)
        self.assertEqual(ShopStatusService._next_open_label(value, value.date() - timedelta(days=1)), "mañana a las 8:00 a. m.")

    def test_forwarded_header_is_ignored_from_untrusted_peer(self):
        self.assertEqual(client_address(request(forwarded="1.1.1.1")), "203.0.113.9")

    def test_forwarded_header_uses_nearest_untrusted_hop(self):
        with patch.object(config, "TRUSTED_PROXY_CIDRS", "10.0.0.0/8"):
            self.assertEqual(client_address(request(peer="10.0.0.2", forwarded="1.1.1.1,203.0.113.9")), "203.0.113.9")

    def test_calendar_error_log_redacts_personal_data(self):
        with self.assertLogs("sebas_barber.calendar", level="ERROR") as captured:
            log_google_error("prueba", RuntimeError("secret@example.com token=privado"))
        self.assertNotIn("secret@example.com", str(captured.output))
        self.assertNotIn("privado", str(captured.output))

    def test_calendar_reads_all_pages_all_day_and_ignores_transparent_events(self):
        service = CalendarService()
        service.enabled = True
        service.service = MagicMock()
        service.service.events.return_value.list.return_value.execute.side_effect = [
            {"items": [{"id": "day", "start": {"date": "2026-10-01"}, "end": {"date": "2026-10-02"}}], "nextPageToken": "second"},
            {"items": [{"id": "free", "transparency": "transparent"}, {"id": "cancelled", "status": "cancelled"}]},
        ]
        busy = service.list_busy("test", datetime.now(timezone.utc), datetime.now(timezone.utc) + timedelta(days=1))
        self.assertEqual(len(busy), 1)
        self.assertEqual(busy[0]["start"], "2026-10-01T00:00:00-06:00")
        self.assertEqual(service.service.events.return_value.list.call_count, 2)

    async def test_health_needs_no_database_and_docs_are_disabled(self):
        with patch.object(config, "RATE_LIMIT_ENABLED", False):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
                health = await client.get("/health")
                self.assertEqual(health.status_code, 200)
                self.assertEqual(health.json()["commit"], config.BUILD_SHA)
                self.assertEqual((await client.get("/docs")).status_code, 404)
                self.assertEqual((await client.get("/openapi.json")).status_code, 404)
                self.assertEqual((await client.get("/api/public/appointments/manage/secret")).status_code, 404)

    async def test_readiness_requires_current_migrations(self):
        for revisions, status, schema in (
            (list(required_schema_revisions()), 200, "current"),
            (["20260728_02"], 503, "migration_required"),
            ([], 503, "migration_required"),
        ):
            result = MagicMock()
            result.scalars.return_value.all.return_value = revisions
            session = MagicMock()
            session.__aenter__.return_value.execute = AsyncMock(return_value=result)
            with patch("app.main.AsyncSessionLocal", return_value=session):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
                    response = await client.get("/health/ready")
            self.assertEqual(response.status_code, status)
            self.assertEqual(response.json()["database"]["schema"], schema)

    async def test_missing_migration_table_is_not_ready_and_does_not_leak_errors(self):
        session = MagicMock()
        session.__aenter__.return_value.execute = AsyncMock(side_effect=SQLAlchemyError("private database details"))
        with patch("app.main.AsyncSessionLocal", return_value=session):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
                response = await client.get("/health/ready")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["database"]["schema"], "unverified")
        self.assertNotIn("private database details", response.text)

    async def test_lookup_requires_code_in_post_body_and_never_accepts_phone_only(self):
        async def fake_db():
            yield MagicMock()
        app.dependency_overrides[get_db] = fake_db
        try:
            with patch.object(config, "RATE_LIMIT_ENABLED", False):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
                    for data in ({}, {"phone": "88887777"}, {"access_code": "<script>"}):
                        response = await client.post("/api/public/appointments/lookup", json=data)
                        self.assertEqual(response.status_code, 422)
                    self.assertEqual((await client.get("/api/public/appointments/lookup?phone=88887777")).status_code, 405)
        finally:
            app.dependency_overrides.clear()


@unittest.skipUnless(os.getenv("TEST_POSTGRES_URL"), "Solo base PostgreSQL desechable de pruebas")
class PostgresConcurrencyTests(unittest.IsolatedAsyncioTestCase):
    async def test_lifespan_starts_on_migrated_schema(self):
        if config.DATABASE_URL != os.environ["TEST_POSTGRES_URL"]:
            self.skipTest("El arranque solo se prueba con DATABASE_URL de pruebas")
        with patch.object(config, "EMAILJS_PUBLIC_KEY", ""):
            async with app.router.lifespan_context(app):
                self.assertEqual(app.version, "5.3.0")

    async def test_overlapping_reservations_are_atomic_and_isolated_by_barber(self):
        engine = create_async_engine(os.environ["TEST_POSTGRES_URL"])
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        barber_ids = [uuid4(), uuid4()]
        starts_at = datetime(2030, 1, 8, 14, tzinfo=timezone.utc)
        try:
            async with sessions() as db:
                for barber_id in barber_ids:
                    db.add(Barber(id=barber_id, name="Prueba", role="Barbero", phone="88887777",
                                  username=str(barber_id), password_hash="disabled"))
                await db.commit()

            async def reserve(barber_id, offset=0):
                async with sessions() as db:
                    db.add(Appointment(
                        barber_id=barber_id, client_name="Prueba de concurrencia", client_phone="88887777",
                        service_name="Corte", total_price=6000, status=AppointmentStatus.confirmed,
                        starts_at=starts_at + timedelta(minutes=offset),
                        ends_at=starts_at + timedelta(minutes=offset + 45),
                    ))
                    try:
                        await db.commit()
                        return True
                    except IntegrityError:
                        await db.rollback()
                        return False

            self.assertEqual(sum(await asyncio.gather(reserve(barber_ids[0]), reserve(barber_ids[0]))), 1)
            self.assertFalse(await reserve(barber_ids[0], 15))
            self.assertTrue(await reserve(barber_ids[0], 45))
            self.assertTrue(await reserve(barber_ids[1]))
        finally:
            await engine.dispose()

    async def test_atomic_budget_and_lease_under_concurrency(self):
        engine = create_async_engine(os.environ["TEST_POSTGRES_URL"])
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async def budget():
            async with sessions() as db:
                result = await reserve_budget(db)
                await db.commit()
                return result
        async def lease():
            async with sessions() as db:
                return await acquire_lease(db, str(uuid4()))
        try:
            with patch.object(config, "EMAIL_MONTHLY_LIMIT", 3):
                self.assertEqual(sum(await asyncio.gather(*(budget() for _ in range(12)))), 3)
            self.assertEqual(sum(await asyncio.gather(*(lease() for _ in range(8)))), 1)
        finally:
            await engine.dispose()
