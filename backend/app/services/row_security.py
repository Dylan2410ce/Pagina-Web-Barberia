from uuid import UUID

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

TABLAS_PRIVADAS = (
    "appointments", "business_hours", "business_breaks", "availability_exceptions",
    "audit_logs", "waitlist_entries", "reviews", "gallery_items", "client_profiles",
    "appointment_feedback", "promotions", "expenses", "cash_closes", "notification_deliveries",
)

CONTEXTO_SQL = text("SELECT set_config('app.security_scope', :scope, true), set_config('app.barber_id', :barber_id, true)")


class ScopedSession(Session):
    pass


@event.listens_for(ScopedSession, "after_begin")
def aplicar_contexto(session, transaction, connection):
    if connection.dialect.name == "postgresql":
        connection.execute(CONTEXTO_SQL, {
            "scope": session.info.get("security_scope", ""),
            "barber_id": session.info.get("barber_id", ""),
        })


async def configurar_contexto(db: AsyncSession, scope: str, barber_id: UUID | None = None):
    if scope not in {"system", "barber"} or (scope == "barber" and barber_id is None):
        raise ValueError("Contexto de acceso inválido")
    valores = {"scope": scope, "barber_id": str(UUID(str(barber_id))) if barber_id else ""}
    db.info.update(security_scope=valores["scope"], barber_id=valores["barber_id"])
    if db.bind.dialect.name == "postgresql" and db.in_transaction():
        await db.execute(CONTEXTO_SQL, valores)


async def verificar_politicas(db: AsyncSession) -> dict:
    if db.bind.dialect.name != "postgresql":
        return {"supported": False, "enforced": False}
    rol = (await db.execute(text(
        "SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user"
    ))).scalar_one()
    protegidas = (await db.execute(text(
        "SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace "
        "AND relname = ANY(:tables) AND relrowsecurity AND relforcerowsecurity"
    ), {"tables": list(TABLAS_PRIVADAS)})).scalar_one()
    return {"supported": True, "tables": protegidas, "expected_tables": len(TABLAS_PRIVADAS),
        "role_bypasses_rls": bool(rol), "enforced": not rol and protegidas == len(TABLAS_PRIVADAS)}
