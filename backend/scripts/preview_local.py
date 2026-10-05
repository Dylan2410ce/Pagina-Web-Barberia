"""Vista de QA aislada en localhost, sin correos, Calendar ni datos reales."""
import asyncio
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import secrets
import sys
from tempfile import TemporaryDirectory
from zoneinfo import ZoneInfo


def main():
    with TemporaryDirectory(prefix="sebas-preview-") as carpeta:
        clave = secrets.token_urlsafe(16)
        os.environ.update(DATABASE_URL="sqlite+aiosqlite:///" + (Path(carpeta) / "preview.db").as_posix(),
            ENVIRONMENT="development", DATABASE_MIGRATION_MODE="false", ADMIN_DEFAULT_PASSWORD=clave,
            GABRIEL_DEFAULT_PASSWORD=clave, ADMIN_PASSWORD_HASH="", GABRIEL_PASSWORD_HASH="",
            CALENDAR_ENABLED="false", CALENDAR_REQUIRED="false", REMINDERS_ENABLED="false",
            DAILY_SUMMARIES_ENABLED="false", EMAIL_PROVIDER="disabled", BREVO_API_KEY="",
            EMAILJS_PUBLIC_KEY="", RATE_LIMIT_ENABLED="false", SENTRY_DSN="",
            SECRET_KEY=secrets.token_urlsafe(48), MASTER_RESET_CODE=secrets.token_urlsafe(48))
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from sqlalchemy import select
        from app.database import AsyncSessionLocal, Base, engine
        from app.models import Appointment, AppointmentStatus, Barber, Service
        from app.services.seed_service import seed_data

        async def preparar():
            async with engine.begin() as conexion:
                await conexion.run_sync(Base.metadata.create_all)
            async with AsyncSessionLocal() as db:
                await seed_data(db)
                barbero = (await db.execute(select(Barber).where(Barber.username == "sebas"))).scalar_one()
                servicio = (await db.execute(select(Service).where(Service.name == "Corte Premium"))).scalar_one()
                hoy = datetime.now(ZoneInfo("America/Costa_Rica")).replace(hour=8, minute=0, second=0, microsecond=0)
                for indice, nombre in enumerate(["Cliente de muestra 1", "Cliente de muestra 2", "Cliente de muestra 3"]):
                    inicio = (hoy + timedelta(minutes=indice * 45)).astimezone(timezone.utc)
                    db.add(Appointment(barber_id=barbero.id, service_id=servicio.id, client_name=nombre,
                        client_phone="00000000", starts_at=inicio, ends_at=inicio + timedelta(minutes=45),
                        total_price=servicio.price, service_name=servicio.name,
                        status=AppointmentStatus.completed if indice == 0 else AppointmentStatus.confirmed))
                await db.commit()
            await engine.dispose()

        asyncio.run(preparar())
        import uvicorn
        print(f"QA local: usuario sebas / clave temporal {clave}", flush=True)
        uvicorn.run("app.main:app", host="127.0.0.1", port=8008, access_log=False)


if __name__ == "__main__":
    main()
