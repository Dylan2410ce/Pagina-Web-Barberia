import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import config
from app.database import Base, get_db
from app.main import app
from app.models import Barber
from app.schemas import AppointmentCreate, ClientAppointmentOut, PublicBarberOut
from app.services.appointment_service import AppointmentService
from app.services.password_service import hash_password
from app.services.rate_limit_service import RateLimiter


class SessionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        async with self.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with self.sessions() as db:
            db.add(Barber(id=uuid4(), name="Prueba", role="Barbero", phone="88887777",
                username="prueba", password_hash=hash_password("ClavePrueba-12345")))
            await db.commit()
        async def database():
            async with self.sessions() as db:
                yield db
        app.dependency_overrides[get_db] = database
        self.rate = patch.object(config, "RATE_LIMIT_ENABLED", False)
        self.rate.start()
        self.environment = patch.object(config, "ENVIRONMENT", "production")
        self.environment.start()
        self.client = AsyncClient(transport=ASGITransport(app), base_url=config.FRONTEND_URL)

    async def asyncTearDown(self):
        await self.client.aclose()
        app.dependency_overrides.clear()
        self.rate.stop()
        self.environment.stop()
        await self.engine.dispose()

    async def login(self):
        return await self.client.post("/api/admin/login", headers={
            "Origin": config.FRONTEND_URL, "X-Session-Mode": "cookie",
        }, json={"username": "prueba", "password": "ClavePrueba-12345"})

    async def test_cookie_is_http_only_strict_secure_and_jwt_not_in_response(self):
        response = await self.login()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["token"], "cookie")
        self.assertTrue(response.json()["csrf_token"])
        cookie = response.headers["set-cookie"]
        for flag in ("__Host-sebas-admin=", "HttpOnly", "Secure", "SameSite=strict", "Path=/"):
            self.assertIn(flag, cookie)
        self.assertNotIn("eyJ", response.text)
        self.assertEqual((await self.client.get("/api/admin/me")).status_code, 200)

    async def test_cookie_mutation_requires_origin_and_csrf(self):
        response = await self.login()
        csrf = response.json()["csrf_token"]
        for headers in ({}, {"Origin": config.FRONTEND_URL}, {"Origin": "https://evil.example", "X-CSRF-Token": csrf}):
            self.assertEqual((await self.client.post("/api/admin/logout", headers=headers)).status_code, 403)
        old_cookie = dict(self.client.cookies)
        response = await self.client.post("/api/admin/logout", headers={"Origin": config.FRONTEND_URL, "X-CSRF-Token": csrf})
        self.assertEqual(response.status_code, 204)
        self.client.cookies.update(old_cookie)
        self.assertEqual((await self.client.get("/api/admin/me")).status_code, 401)

    async def test_cross_origin_login_is_rejected_before_password_check(self):
        response = await self.client.post("/api/admin/login", headers={"Origin": "https://evil.example", "X-Session-Mode": "cookie"},
            json={"username": "prueba", "password": "ClavePrueba-12345"})
        self.assertEqual(response.status_code, 403)

    async def test_private_route_requires_authentication(self):
        self.assertEqual((await self.client.get("/api/admin/appointments")).status_code, 401)

    async def test_account_limit_survives_restarts_and_normalizes_username(self):
        with patch.object(config, "RATE_LIMIT_ENABLED", True), patch.object(config, "DATABASE_MIGRATION_MODE", False):
            await RateLimiter(self.sessions).check_account("Prueba", "test", 1, 900)
            with self.assertRaises(Exception) as raised:
                await RateLimiter(self.sessions).check_account(" prueba ", "test", 1, 900)
            self.assertEqual(raised.exception.status_code, 429)


class PrivacyTests(unittest.IsolatedAsyncioTestCase):
    def test_public_barber_does_not_serialize_internal_settings(self):
        payload = PublicBarberOut.model_validate({"id": uuid4(), "name": "Prueba", "role": "Barbero", "phone": "88887777",
            "email": "private@example.com", "calendar_sync": True, "daily_summary_enabled": True}).model_dump()
        self.assertFalse({"email", "calendar_sync", "daily_summary_enabled"}.intersection(payload))

    def test_client_appointment_does_not_expose_google_event_id(self):
        payload = ClientAppointmentOut.model_validate({"id": uuid4(), "barber_id": uuid4(), "client_name": "Prueba",
            "client_phone": "88887777", "service_name": "Corte", "addons": [], "total_price": 5000,
            "starts_at": datetime.now(timezone.utc), "ends_at": datetime.now(timezone.utc), "status": "booked",
            "calendar_event_id": "private_google_event"}).model_dump()
        self.assertNotIn("calendar_event_id", payload)

    async def test_booking_code_does_not_unlock_other_bookings_by_phone(self):
        service = AppointmentService(AsyncMock())
        appointment = object()
        service.get_by_access_code = AsyncMock(return_value=appointment)
        self.assertEqual(await service.history_by_access_code("code"), [appointment])

    def test_mass_assignment_and_markup_are_rejected(self):
        from pydantic import ValidationError
        base = {"barber_id": uuid4(), "service_id": uuid4(), "date": "2026-12-10", "start_min": 480,
            "client_name": "Cliente", "client_phone": "88887777"}
        for extra in ({"role": "admin"}, {"client_name": "<script>alert(1)</script>"}):
            with self.assertRaises(ValidationError):
                AppointmentCreate.model_validate({**base, **extra})
