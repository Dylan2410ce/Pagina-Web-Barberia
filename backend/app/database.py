from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import config


class Base(DeclarativeBase):
    pass


engine = create_engine(config.DATABASE_URL, pool_pre_ping=True)
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
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))
        conn.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'no_double_booking'
                    ) THEN
                        ALTER TABLE appointments
                        ADD CONSTRAINT no_double_booking
                        EXCLUDE USING gist (
                            barber_id WITH =,
                            tstzrange(starts_at, ends_at, '[)') WITH &&
                        )
                        WHERE (status IN ('booked', 'blocked', 'present'));
                    END IF;
                END $$;
                """
            )
        )

