from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import config


class Base(DeclarativeBase):
    pass


engine = create_engine(
    config.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_use_lifo=True,
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app import models

    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_email VARCHAR(160)"))
        conn.execute(text("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS calendar_event_id VARCHAR(255)"))
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_appointments_barber_status_start
                ON appointments (barber_id, status, starts_at)
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_appointments_phone_start
                ON appointments (client_phone, starts_at DESC)
                """
            )
        )
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))
        conn.execute(text("ALTER TABLE appointments DROP CONSTRAINT IF EXISTS no_double_booking"))
        conn.execute(
            text(
                """
                ALTER TABLE appointments
                ADD CONSTRAINT no_double_booking
                EXCLUDE USING gist (
                    barber_id WITH =,
                    tstzrange(starts_at, ends_at, '[)') WITH &&
                )
                WHERE (status IN ('booked', 'blocked', 'present'));
                """
            )
        )
