from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Barber

INITIAL_PROFILE_ORDER = ("sebas", "gabriel")


class BarberRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def all_active(self) -> list[Barber]:
        result = await self.db.execute(
            select(Barber).where(
                Barber.is_active.is_(True),
            )
        )
        rows = list(result.scalars().all())
        order = {username: index for index, username in enumerate(INITIAL_PROFILE_ORDER)}
        return sorted(rows, key=lambda barber: (order.get(barber.username, 99), barber.name.casefold()))

    async def all_profiles(self) -> list[Barber]:
        result = await self.db.execute(select(Barber).order_by(Barber.is_active.desc(), Barber.name))
        return list(result.scalars().all())

    async def profile_for_update(self, barber_id: UUID) -> Barber | None:
        result = await self.db.execute(
            select(Barber).where(Barber.id == barber_id).with_for_update()
            .execution_options(populate_existing=True)
        )
        return result.scalar_one_or_none()

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
