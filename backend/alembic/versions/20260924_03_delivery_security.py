"""Consolida el esquema heredado y agrega control persistente de entregas y trafico."""
from alembic import op
from sqlalchemy import inspect, text
from app.models import RateLimitBucket, NotificationBudget, DispatchLease

revision = "20260924_03"
down_revision = "20260728_02"
branch_labels = None
depends_on = None

LEGACY_STATEMENTS = [
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

def upgrade():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            for value in ("pending", "confirmed", "completed", "no_show"):
                op.execute(text("ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS '" + value + "'"))
            for value in ("appointment_created", "appointment_cancelled", "appointment_rescheduled"):
                op.execute(text("ALTER TYPE notificationkind ADD VALUE IF NOT EXISTS '" + value + "'"))
            op.execute("ALTER TYPE notificationstatus ADD VALUE IF NOT EXISTS 'uncertain'")
        for statement in LEGACY_STATEMENTS:
            op.execute(statement)
        op.execute("ALTER TABLE notification_deliveries ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ")
    else:
        columns = {column["name"] for column in inspect(bind).get_columns("notification_deliveries")}
        if "claimed_at" not in columns:
            import sqlalchemy as sa
            op.add_column("notification_deliveries", sa.Column("claimed_at", sa.DateTime(timezone=True)))
    for model in (RateLimitBucket, NotificationBudget, DispatchLease):
        model.__table__.create(bind, checkfirst=True)

def downgrade():
    raise RuntimeError("Esta revision conserva las reservas; restaurar desde un respaldo verificado.")

