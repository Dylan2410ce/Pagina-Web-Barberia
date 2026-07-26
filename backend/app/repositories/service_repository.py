from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Service


class ServiceRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def all_active(self) -> list[Service]:
        result = await self.db.execute(
            select(Service)
            .where(Service.is_active.is_(True))
            .order_by(Service.is_addon, Service.price)
        )
        return list(result.scalars().all())

    async def all(self) -> list[Service]:
        result = await self.db.execute(
            select(Service).order_by(Service.is_addon, Service.price)
        )
        return list(result.scalars().all())

    async def by_id(self, service_id) -> Service | None:
        result = await self.db.execute(
            select(Service).where(
                Service.id == service_id,
                Service.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def by_id_any(self, service_id) -> Service | None:
        result = await self.db.execute(select(Service).where(Service.id == service_id))
        return result.scalar_one_or_none()

    async def by_ids(self, ids: list) -> list[Service]:
        if not ids:
            return []
        result = await self.db.execute(
            select(Service).where(
                Service.id.in_(ids),
                Service.is_active.is_(True),
            )
        )
        return list(result.scalars().all())

    def save(self, service: Service) -> Service:
        self.db.add(service)
        return service
