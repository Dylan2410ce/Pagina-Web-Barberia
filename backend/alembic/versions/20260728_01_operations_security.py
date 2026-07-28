"""Operación, recordatorios y seguridad."""

from alembic import op

from app.database import Base
from app import models

revision = "20260728_01"
down_revision = None
branch_labels = None
depends_on = None


POSTGRES_ALTERS = (
    "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS email VARCHAR(160)",
    "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS cancellation_notice_hours INTEGER NOT NULL DEFAULT 2",
    "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS reschedule_notice_hours INTEGER NOT NULL DEFAULT 2",
    "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS appointment_buffer_min INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS daily_summary_enabled BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS parking_info VARCHAR(240)",
    "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS directions_hint VARCHAR(240)",
    "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS public_message VARCHAR(240)",
    "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS request_id UUID",
    "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS request_fingerprint VARCHAR(64)",
    "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS access_code_encrypted TEXT",
    "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_attempts INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS promotion_name VARCHAR(120)",
    "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS last_notification_error TEXT",
    "ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ",
    "ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS notification_attempts INTEGER NOT NULL DEFAULT 0",
    """
    CREATE UNIQUE INDEX IF NOT EXISTS ix_appointments_request_id
    ON appointments (request_id)
    WHERE request_id IS NOT NULL
    """,
)


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    if bind.dialect.name == "postgresql":
        for statement in POSTGRES_ALTERS:
            op.execute(statement)


def downgrade() -> None:
    # La migración conserva datos históricos y no ejecuta borrados automáticos.
    pass
