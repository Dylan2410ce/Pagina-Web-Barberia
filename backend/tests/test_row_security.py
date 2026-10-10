import os
import unittest
from uuid import uuid4

from sqlalchemy import delete, select, text, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import config
from app.models import Barber, BusinessHour
from app.services.row_security import ScopedSession, configurar_contexto, verificar_politicas


@unittest.skipUnless(os.getenv("TEST_POSTGRES_URL"), "Requiere PostgreSQL desechable con permiso para crear roles")
class RowSecurityTests(unittest.IsolatedAsyncioTestCase):
    async def test_rls_rejects_cross_barber_writes_and_unscoped_reads(self):
        self.assertEqual(config.DATABASE_URL, os.environ["TEST_POSTGRES_URL"])
        engine = create_async_engine(os.environ["TEST_POSTGRES_URL"])
        sessions = async_sessionmaker(engine, expire_on_commit=False, sync_session_class=ScopedSession)
        primero, segundo = uuid4(), uuid4()
        try:
            async with engine.begin() as connection:
                await connection.execute(text("CREATE ROLE sebas_rls_test NOLOGIN NOSUPERUSER NOBYPASSRLS"))
                await connection.execute(text("GRANT USAGE ON SCHEMA public TO sebas_rls_test"))
                await connection.execute(text("GRANT SELECT, INSERT, UPDATE ON business_hours TO sebas_rls_test"))
            async with sessions() as db:
                await configurar_contexto(db, "system")
                for identificador in (primero, segundo):
                    db.add(Barber(id=identificador, name="RLS Test", role="Barbero", phone="88887777",
                        username=f"rls_{identificador.hex}", password_hash="disabled"))
                await db.flush()
                db.add_all([BusinessHour(barber_id=identificador, weekday=0, open_min=480, close_min=1140)
                    for identificador in (primero, segundo)])
                await db.commit()
            async with sessions() as db:
                await db.execute(text("SET LOCAL ROLE sebas_rls_test"))
                self.assertEqual((await db.execute(select(BusinessHour))).scalars().all(), [])
                await configurar_contexto(db, "barber", primero)
                estado = await verificar_politicas(db)
                self.assertTrue(estado["enforced"])
                rows = (await db.execute(select(BusinessHour))).scalars().all()
                self.assertEqual([row.barber_id for row in rows], [primero])
                result = await db.execute(update(BusinessHour).where(BusinessHour.barber_id == segundo).values(is_open=False))
                self.assertEqual(result.rowcount, 0)
                with self.assertRaises(DBAPIError):
                    await db.execute(update(BusinessHour).where(BusinessHour.barber_id == primero).values(barber_id=segundo))
                await db.rollback()
                # El contexto se repone tras rollback/commit y no depende de la conexión del pool.
                await db.execute(text("SET LOCAL ROLE sebas_rls_test"))
                self.assertEqual([row.barber_id for row in (await db.execute(select(BusinessHour))).scalars()], [primero])
            async with sessions() as db:
                await db.execute(text("SET LOCAL ROLE sebas_rls_test"))
                self.assertEqual((await db.execute(select(BusinessHour))).scalars().all(), [])
        finally:
            async with engine.begin() as connection:
                await connection.execute(delete(BusinessHour).where(BusinessHour.barber_id.in_([primero, segundo])))
                await connection.execute(delete(Barber).where(Barber.id.in_([primero, segundo])))
                await connection.execute(text("DROP OWNED BY sebas_rls_test"))
                await connection.execute(text("DROP ROLE sebas_rls_test"))
            await engine.dispose()
