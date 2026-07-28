from datetime import date
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Promotion, PromotionType


class PromotionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def active_for(
        self,
        barber_id: UUID,
        service_id: UUID,
        day: date,
    ) -> list[Promotion]:
        result = await self.db.execute(
            select(Promotion).where(
                Promotion.barber_id == barber_id,
                Promotion.is_active.is_(True),
                Promotion.start_date <= day,
                Promotion.end_date >= day,
                or_(
                    Promotion.service_id == service_id,
                    Promotion.service_id.is_(None),
                ),
            )
        )
        return list(result.scalars().all())

    async def apply(
        self,
        barber_id: UUID,
        service_id: UUID,
        day: date,
        total: int,
    ) -> tuple[int, int, str | None]:
        promotions = await self.active_for(barber_id, service_id, day)
        best_discount = 0
        best_name = None
        for promotion in promotions:
            if promotion.discount_type == PromotionType.percentage:
                discount = round(total * promotion.discount_value / 100)
            else:
                discount = promotion.discount_value
            discount = min(max(discount, 0), max(total - 1, 0))
            if discount > best_discount:
                best_discount = discount
                best_name = promotion.name
        return total - best_discount, best_discount, best_name
