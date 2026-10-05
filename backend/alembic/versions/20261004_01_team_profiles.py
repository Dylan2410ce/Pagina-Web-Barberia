"""Permite administrar perfiles sin eliminar su historial."""
from alembic import op
import sqlalchemy as sa

revision = "20261004_01"
down_revision = "20260924_03"
branch_labels = None
depends_on = None


def upgrade():
    columnas = {item["name"] for item in sa.inspect(op.get_bind()).get_columns("barbers")}
    if "photo_url" not in columnas:
        op.add_column("barbers", sa.Column("photo_url", sa.String(500), nullable=True))
    for usuario, foto in (("sebas", "Sebastian"), ("gabriel", "Gabriel")):
        op.execute(sa.text("UPDATE barbers SET photo_url = :foto WHERE username = :usuario AND photo_url IS NULL")
            .bindparams(foto=f"/assets/fotosbarberias/{foto}.png", usuario=usuario))
    indices = {item["name"] for item in sa.inspect(op.get_bind()).get_indexes("barbers")}
    if "uq_barbers_active_calendar" not in indices:
        condicion = sa.text("is_active AND calendar_sync AND calendar_id IS NOT NULL")
        op.create_index("uq_barbers_active_calendar", "barbers", ["calendar_id"], unique=True,
            postgresql_where=condicion, sqlite_where=condicion)


def downgrade():
    op.drop_index("uq_barbers_active_calendar", table_name="barbers")
    op.drop_column("barbers", "photo_url")
