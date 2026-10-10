"""Aislamiento por barbero adicional a la autorización de la API."""
from alembic import op

revision = "20261010_01"
down_revision = "20261004_01"
branch_labels = None
depends_on = None

TABLAS = (
    "appointments", "business_hours", "business_breaks", "availability_exceptions",
    "audit_logs", "waitlist_entries", "reviews", "gallery_items", "client_profiles",
    "appointment_feedback", "promotions", "expenses", "cash_closes", "notification_deliveries",
)
POLITICA = (
    "current_setting('app.security_scope', true) = 'system' OR "
    "(current_setting('app.security_scope', true) = 'barber' AND "
    "barber_id::text = current_setting('app.barber_id', true))"
)


def upgrade():
    if op.get_bind().dialect.name != "postgresql":
        return
    for tabla in TABLAS:
        op.execute(f'ALTER TABLE "{tabla}" ENABLE ROW LEVEL SECURITY')
        op.execute(f'ALTER TABLE "{tabla}" FORCE ROW LEVEL SECURITY')
        op.execute(f'CREATE POLICY aislamiento_barbero ON "{tabla}" USING ({POLITICA}) WITH CHECK ({POLITICA})')


def downgrade():
    if op.get_bind().dialect.name != "postgresql":
        return
    for tabla in reversed(TABLAS):
        op.execute(f'DROP POLICY aislamiento_barbero ON "{tabla}"')
        op.execute(f'ALTER TABLE "{tabla}" NO FORCE ROW LEVEL SECURITY')
        op.execute(f'ALTER TABLE "{tabla}" DISABLE ROW LEVEL SECURITY')
