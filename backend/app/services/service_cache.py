import asyncio
from time import monotonic

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import config
from app.repositories.service_repository import ServiceRepository
from app.schemas import ServiceOut


class ServiceCache:
    def __init__(self):
        self._items: tuple[ServiceOut, ...] = ()
        self._expires_at = 0.0
        self._lock = asyncio.Lock()

    async def get(self, db: AsyncSession) -> list[ServiceOut]:
        if self._items and monotonic() < self._expires_at:
            return list(self._items)

        async with self._lock:
            if self._items and monotonic() < self._expires_at:
                return list(self._items)
            rows = await ServiceRepository(db).all_active()
            self._items = tuple(ServiceOut.model_validate(row) for row in rows)
            self._expires_at = monotonic() + config.SERVICE_CACHE_TTL_SECONDS
            return list(self._items)

    def invalidate(self) -> None:
        self._items = ()
        self._expires_at = 0.0


service_cache = ServiceCache()
