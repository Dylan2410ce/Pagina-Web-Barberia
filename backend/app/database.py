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
        if conn.dialect.name != "postgresql":
            return

        migrations = [
            "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS calendar_sync BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS calendar_id VARCHAR(255)",
            "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS instagram_url VARCHAR(255)",
            "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS credentials_initialized BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_email VARCHAR(160)",
            "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS calendar_event_id VARCHAR(255)",
            "ALTER TABLE business_hours ADD COLUMN IF NOT EXISTS barber_id UUID REFERENCES barbers(id)",
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
            "CREATE EXTENSION IF NOT EXISTS btree_gist",
            "ALTER TABLE appointments DROP CONSTRAINT IF EXISTS no_double_booking",
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'no_double_booking_per_barber'
                ) THEN
                    ALTER TABLE appointments
                    ADD CONSTRAINT no_double_booking_per_barber
                    EXCLUDE USING gist (
                        barber_id WITH =,
                        tstzrange(starts_at, ends_at, '[)') WITH &&
                    )
                    WHERE (status IN ('booked', 'blocked', 'present'));
                END IF;
            END $$;
            """,
        ]
        for statement in migrations:
            await conn.execute(text(statement))
