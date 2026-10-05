import asyncio
import os
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import Appointment, AppointmentStatus, AuditLog, Barber, BusinessBreak, BusinessHour
from app.repositories.barber_repository import BarberRepository
from app.schemas_team import CrearBarbero, EditarBarbero, EquipoOut
from app.services.auth_service import login
from app.services.appointment_service import AppointmentService
from app.services.password_service import verify_password
from app.services.seed_service import seed_data
from app.services.team_service import EquipoService
from app.services.shop_status_service import ShopStatusService
from app.services.notification_service import NotificationService


class EquipoTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        self.sesiones = async_sessionmaker(self.engine, expire_on_commit=False)
        async with self.engine.begin() as conexion:
            await conexion.run_sync(Base.metadata.create_all)
        self.db = self.sesiones()
        self.propietario = Barber(name="Sebastián", role="Barbero principal", phone="83778700", username="sebas", password_hash="unconfigured", is_active=True)
        self.db.add(self.propietario)
        await self.db.commit()
        self.servicio = EquipoService(self.db, self.propietario)

    async def asyncTearDown(self):
        await self.db.close()
        await self.engine.dispose()

    def datos(self, **cambios):
        return CrearBarbero(name="Nuevo barbero", username="nuevo", phone="88887777", password="ClaveDePrueba-2026!", **cambios)

    async def test_crea_perfil_horarios_y_clave_hasheada_sin_exponerla(self):
        perfil = await self.servicio.crear(self.datos())
        self.assertTrue(verify_password("ClaveDePrueba-2026!", perfil.password_hash))
        self.assertNotIn("password", EquipoOut.model_validate(perfil).model_dump())
        self.assertFalse(perfil.calendar_sync)
        self.assertEqual(await self.db.scalar(select(func.count()).select_from(BusinessHour).where(BusinessHour.barber_id == perfil.id)), 7)
        self.assertIn(perfil.id, [item.id for item in await BarberRepository(self.db).all_active()])
        self.assertTrue(await login(self.db, "nuevo", "ClaveDePrueba-2026!"))

    async def test_otro_barbero_no_puede_administrar_equipo(self):
        with self.assertRaises(HTTPException) as error:
            EquipoService(self.db, SimpleNamespace(username="gabriel", role="owner"))
        self.assertEqual(error.exception.status_code, 403)

    async def test_usuario_duplicado_devuelve_conflicto(self):
        await self.servicio.crear(self.datos())
        with self.assertRaises(HTTPException) as error:
            await self.servicio.crear(self.datos())
        self.assertEqual(error.exception.status_code, 409)

    async def test_retirar_conserva_historial_y_reinicio_no_reactiva(self):
        perfil = await self.servicio.crear(self.datos())
        inicio = datetime.now(timezone.utc) - timedelta(days=2)
        cita = Appointment(barber_id=perfil.id, client_name="Cliente histórico", client_phone="88887777", service_name="Corte", addons=[], total_price=5000, starts_at=inicio, ends_at=inicio + timedelta(minutes=45), status=AppointmentStatus.completed)
        self.db.add(cita)
        await self.db.commit()
        version = perfil.session_version
        await self.servicio.retirar(perfil.id)
        self.assertFalse(perfil.is_active)
        self.assertGreater(perfil.session_version, version)
        await seed_data(self.db)
        await self.db.refresh(perfil)
        self.assertFalse(perfil.is_active)
        self.assertIsNotNone(await self.db.get(Appointment, cita.id))
        self.assertIsNone(await BarberRepository(self.db).by_username("nuevo"))
        await self.servicio.reactivar(perfil.id)
        self.assertTrue(perfil.is_active)
        self.assertEqual(await self.db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.entity_type == "barber")), 3)

    async def test_no_retirar_propietario_o_barbero_con_cita_futura(self):
        with self.assertRaises(HTTPException) as error:
            await self.servicio.retirar(self.propietario.id)
        self.assertEqual(error.exception.status_code, 409)
        perfil = await self.servicio.crear(self.datos())
        inicio = datetime.now(timezone.utc) + timedelta(days=2)
        self.db.add(Appointment(barber_id=perfil.id, client_name="Cliente", client_phone="88887777", service_name="Corte", addons=[], total_price=5000, starts_at=inicio, ends_at=inicio + timedelta(minutes=45), status=AppointmentStatus.pending))
        await self.db.commit()
        with self.assertRaises(HTTPException) as error:
            await self.servicio.retirar(perfil.id)
        self.assertEqual(error.exception.status_code, 409)
        self.assertTrue(perfil.is_active)
        with self.assertRaises(HTTPException):
            await self.servicio.editar(perfil.id, EditarBarbero(name=perfil.name, phone=perfil.phone, calendar_sync=True, calendar_id="equipo@example.com"))

    async def test_seed_preserva_personalizacion_y_nuevos_perfiles(self):
        perfil = await self.servicio.crear(self.datos())
        datos = EditarBarbero(name="Nombre actualizado", role="Estilista", phone="88887777", calendar_sync=True, calendar_id="nuevo@example.com")
        await self.servicio.editar(perfil.id, datos)
        self.propietario.name = "Sebas personalizado"
        await self.db.commit()
        await seed_data(self.db)
        await self.db.refresh(perfil)
        await self.db.refresh(self.propietario)
        self.assertTrue(perfil.is_active)
        self.assertEqual(perfil.calendar_id, "nuevo@example.com")
        self.assertEqual(self.propietario.name, "Sebas personalizado")

    async def test_calendario_no_se_comparte_entre_perfiles_activos(self):
        self.propietario.calendar_sync = True
        self.propietario.calendar_id = "agenda@example.com"
        await self.db.commit()
        with self.assertRaises(HTTPException) as error:
            await self.servicio.crear(self.datos(calendar_sync=True, calendar_id="agenda@example.com"))
        self.assertEqual(error.exception.status_code, 409)

    async def test_estado_del_equipo_incluye_perfiles_nuevos_y_excluye_retirados(self):
        perfil = await self.servicio.crear(self.datos())
        estados = await ShopStatusService(self.db).status_all()
        self.assertIn(perfil.id, [estado["barber_id"] for estado in estados])
        await self.servicio.retirar(perfil.id)
        estados = await ShopStatusService(self.db).status_all()
        self.assertNotIn(perfil.id, [estado["barber_id"] for estado in estados])

    def test_login_no_falla_con_clave_unicode_demasiado_larga(self):
        self.assertFalse(verify_password("á" * 80, "$2b$12$VqyDQpsmOujx1STVz9cSXu.pTr.AW3w23DYy5UVoHlLdJ/H8wG7my"))

    def test_correo_del_perfil_se_respeta_sin_cruzar_destinatarios(self):
        self.assertEqual(NotificationService._barber_email(SimpleNamespace(username="nuevo", email="nuevo@example.com")), "nuevo@example.com")
        self.assertEqual(NotificationService._barber_email(SimpleNamespace(username="sebas", email="perfil@example.com")), "perfil@example.com")
        self.assertEqual(NotificationService._barber_email(SimpleNamespace(username="nuevo", email=None)), "")

    def test_validaciones_rechazan_enlaces_peligrosos_y_claves_debiles(self):
        for campo, valor in [("instagram_url", "javascript:alert(1)"), ("photo_url", "//evil.test/a.png"), ("photo_url", "/assets/../secreto.png")]:
            with self.assertRaises(ValidationError):
                self.datos(**{campo: valor})
        with self.assertRaises(ValidationError):
            self.datos(calendar_sync=True)


@unittest.skipUnless(os.getenv("TEST_POSTGRES_URL"), "Requiere PostgreSQL desechable de CI")
class EquipoConcurrencyTests(unittest.IsolatedAsyncioTestCase):
    async def test_retiro_y_reserva_comparten_bloqueo_de_perfil(self):
        engine = create_async_engine(os.environ["TEST_POSTGRES_URL"])
        sesiones = async_sessionmaker(engine, expire_on_commit=False)
        perfil_id = None
        try:
            async with sesiones() as db:
                propietario = (await db.execute(select(Barber).where(Barber.username == "sebas"))).scalar_one_or_none()
                if propietario is None:
                    propietario = Barber(name="Propietario de prueba", username="sebas", role="Barbero principal", phone="88887777", password_hash="unconfigured", is_active=True)
                    db.add(propietario)
                    await db.flush()
                perfil = await EquipoService(db, propietario).crear(CrearBarbero(name="Prueba concurrente",
                    username=f"test_{uuid4().hex[:12]}", phone="88887777", password="TemporalDePrueba-2026!"))
                perfil_id = perfil.id
                propietario_id = propietario.id
            preparado, terminar = asyncio.Event(), asyncio.Event()

            async def retirar():
                async with sesiones() as db:
                    servicio = EquipoService(db, SimpleNamespace(id=propietario_id, username="sebas"))
                    async def guardar_despues():
                        preparado.set()
                        await terminar.wait()
                        await db.commit()
                    with patch.object(servicio, "_guardar", side_effect=guardar_despues):
                        await servicio.retirar(perfil_id)

            async def intentar_reserva():
                async with sesiones() as db:
                    try:
                        await AppointmentService(db).lock_schedule(perfil_id, datetime.now(timezone.utc).date())
                        return 200
                    except HTTPException as error:
                        return error.status_code

            retiro = asyncio.create_task(retirar())
            await asyncio.wait_for(preparado.wait(), 10)
            reserva = asyncio.create_task(intentar_reserva())
            try:
                with self.assertRaises(asyncio.TimeoutError):
                    await asyncio.wait_for(asyncio.shield(reserva), .1)
            finally:
                terminar.set()
            await asyncio.wait_for(retiro, 10)
            self.assertEqual(await asyncio.wait_for(reserva, 10), 409)
        finally:
            if perfil_id:
                async with sesiones() as db:
                    await db.execute(delete(AuditLog).where(AuditLog.entity_id == perfil_id))
                    await db.execute(delete(BusinessBreak).where(BusinessBreak.barber_id == perfil_id))
                    await db.execute(delete(BusinessHour).where(BusinessHour.barber_id == perfil_id))
                    await db.execute(delete(Barber).where(Barber.id == perfil_id))
                    await db.commit()
            await engine.dispose()
