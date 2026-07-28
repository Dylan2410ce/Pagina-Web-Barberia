from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import config


class Base(DeclarativeBase):
    pass


engine_options = {}
if config.DATABASE_URL.startswith("postgresql+asyncpg://"):
    engine_options.update(
        {
            "pool_pre_ping": True,
            "pool_recycle": 300,
            "pool_use_lifo": True,
        }
    )
    engine_options["connect_args"] = {"ssl": config.DATABASE_SSL}

engine = create_async_engine(config.DATABASE_URL, **engine_options)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db():
    async with AsyncSessionLocal() as db:
        yield db


async def init_db():
    from app import models

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        is_postgresql = conn.dialect.name == "postgresql"

    if not is_postgresql:
        return

    enum_values = ("pending", "confirmed", "completed", "no_show")
    async with engine.connect() as raw_conn:
        autocommit_conn = await raw_conn.execution_options(
            isolation_level="AUTOCOMMIT",
        )
        for value in enum_values:
            await autocommit_conn.execute(
                text(
                    "ALTER TYPE appointmentstatus "
                    f"ADD VALUE IF NOT EXISTS '{value}'"
                )
            )

    migrations = [
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS calendar_sync BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS calendar_id VARCHAR(255)",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS instagram_url VARCHAR(255)",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS email VARCHAR(160)",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS credentials_initialized BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS cancellation_notice_hours INTEGER NOT NULL DEFAULT 2",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS reschedule_notice_hours INTEGER NOT NULL DEFAULT 2",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS appointment_buffer_min INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS daily_summary_enabled BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS parking_info VARCHAR(240)",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS directions_hint VARCHAR(240)",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS public_message VARCHAR(240)",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_email VARCHAR(160)",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS calendar_event_id VARCHAR(255)",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id)",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS access_code_hash VARCHAR(64)",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS access_code_hint VARCHAR(8)",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS access_code_encrypted TEXT",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS request_id UUID",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS request_fingerprint VARCHAR(64)",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_attempts INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS promotion_name VARCHAR(120)",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS last_notification_error TEXT",
        "ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ",
        "ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS notification_attempts INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE business_hours ADD COLUMN IF NOT EXISTS barber_id UUID REFERENCES barbers(id)",
        """
        UPDATE appointments
        SET status = CASE status::text
            WHEN 'booked' THEN 'confirmed'::appointmentstatus
            WHEN 'present' THEN 'completed'::appointmentstatus
            WHEN 'noshow' THEN 'no_show'::appointmentstatus
            ELSE status
        END
        WHERE status::text IN ('booked', 'present', 'noshow')
        """,
        "ALTER TABLE appointments ALTER COLUMN status SET DEFAULT 'pending'",
        """
        UPDATE business_hours
        SET barber_id = (SELECT id FROM barbers WHERE username = 'sebas' LIMIT 1)
        WHERE barber_id IS NULL
        """,
        "ALTER TABLE business_hours DROP CONSTRAINT IF EXISTS business_hours_weekday_key",
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM business_hours WHERE barber_id IS NULL) THEN
                ALTER TABLE business_hours ALTER COLUMN barber_id SET NOT NULL;
            END IF;
        END $$;
        """,
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uq_business_hours_barber_weekday'
            ) THEN
                ALTER TABLE business_hours
                ADD CONSTRAINT uq_business_hours_barber_weekday
                UNIQUE (barber_id, weekday);
            END IF;
        END $$;
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_business_hours_barber_weekday
        ON business_hours (barber_id, weekday)
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_appointments_barber_status_start
        ON appointments (barber_id, status, starts_at)
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_appointments_phone_start
        ON appointments (client_phone, starts_at DESC)
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_appointments_service_id
        ON appointments (service_id)
        """,
        """
        UPDATE appointments AS appointment
        SET service_id = service.id
        FROM services AS service
        WHERE appointment.service_id IS NULL
          AND LOWER(appointment.service_name) = LOWER(service.name)
        """,
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ix_appointments_access_code_hash
        ON appointments (access_code_hash)
        WHERE access_code_hash IS NOT NULL
        """,
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ix_appointments_request_id
        ON appointments (request_id)
        WHERE request_id IS NOT NULL
        """,
        "DROP TABLE IF EXISTS loyalty_redemptions",
        "ALTER TABLE client_profiles DROP COLUMN IF EXISTS loyalty_redeemed",
        "CREATE EXTENSION IF NOT EXISTS btree_gist",
        "ALTER TABLE appointments DROP CONSTRAINT IF EXISTS no_double_booking",
        "ALTER TABLE appointments DROP CONSTRAINT IF EXISTS no_double_booking_per_barber",
        """
        ALTER TABLE appointments
        ADD CONSTRAINT no_double_booking_per_barber
        EXCLUDE USING gist (
            barber_id WITH =,
            tstzrange(starts_at, ends_at, '[)') WITH &&
        )
        WHERE (status IN ('pending', 'confirmed', 'blocked'))
        """,
    ]
    async with engine.begin() as conn:
        for statement in migrations:
            await conn.execute(text(statement))
