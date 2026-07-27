from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def record(
        self,
        *,
        barber_id: UUID,
        action: str,
        entity_type: str,
        entity_id: UUID | None = None,
        details: dict | None = None,
    ) -> AuditLog:
        item = AuditLog(
            barber_id=barber_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or {},
        )
        self.db.add(item)
        return item
