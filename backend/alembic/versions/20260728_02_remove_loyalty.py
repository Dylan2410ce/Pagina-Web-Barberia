"""Elimina el sistema de fidelizacion y sus datos asociados."""

from alembic import op
from sqlalchemy import inspect


revision = "20260728_02"
down_revision = "20260728_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP TABLE IF EXISTS loyalty_redemptions")
        op.execute(
            "ALTER TABLE client_profiles "
            "DROP COLUMN IF EXISTS loyalty_redeemed"
        )
        return

    inspector = inspect(bind)
    if "loyalty_redemptions" in inspector.get_table_names():
        op.drop_table("loyalty_redemptions")
    if "client_profiles" in inspector.get_table_names():
        columns = {
            column["name"]
            for column in inspector.get_columns("client_profiles")
        }
        if "loyalty_redeemed" in columns:
            op.drop_column("client_profiles", "loyalty_redeemed")


def downgrade() -> None:
    # La eliminacion solicitada es intencional y no restaura recompensas.
    pass
