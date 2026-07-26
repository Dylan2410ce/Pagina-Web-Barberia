from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Barber

PUBLIC_USERNAMES = ("sebas", "gabriel")


class BarberRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def all_active(self) -> list[Barber]:
        result = await self.db.execute(
            select(Barber).where(
                Barber.is_active.is_(True),
                Barber.username.in_(PUBLIC_USERNAMES),
            )
        )
        rows = list(result.scalars().all())
        order = {username: index for index, username in enumerate(PUBLIC_USERNAMES)}
        return sorted(rows, key=lambda barber: order.get(barber.username, 99))

    async def by_id(self, barber_id) -> Barber | None:
        try:
            normalized_id = UUID(str(barber_id))
        except (TypeError, ValueError):
            return None
        result = await self.db.execute(
            select(Barber).where(
                Barber.id == normalized_id,
                Barber.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def by_username(self, username: str) -> Barber | None:
        result = await self.db.execute(
            select(Barber).where(
                Barber.username == username.lower().strip(),
                Barber.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()
