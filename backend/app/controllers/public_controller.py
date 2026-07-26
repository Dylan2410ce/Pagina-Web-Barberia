from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import config
from app.database import get_db
from app.models import Barber, BusinessHour
from app.repositories.barber_repository import BarberRepository
from app.schemas import BootstrapOut, ServiceOut
from app.services.service_cache import service_cache

router = APIRouter(prefix="/api/public", tags=["Public"])


@router.get("/services", response_model=list[ServiceOut])
async def services(db: AsyncSession = Depends(get_db)):
    return await service_cache.get(db)


@router.get("/init", response_model=BootstrapOut)
async def init(db: AsyncSession = Depends(get_db)):
    barbers = await BarberRepository(db).all_active()
    items = await service_cache.get(db)
    hours_result = await db.execute(
        select(BusinessHour)
        .join(Barber, Barber.id == BusinessHour.barber_id)
        .where(Barber.is_active.is_(True))
        .order_by(BusinessHour.barber_id, BusinessHour.weekday)
    )
    business_hours = list(hours_result.scalars().all())

    return {
        "barbers": barbers,
        "services": [item for item in items if not item.is_addon],
        "addons": [item for item in items if item.is_addon],
        "business_hours": business_hours,
        "location": {
            "name": config.SHOP_NAME,
            "address": config.ADDRESS,
            "lat": config.LAT,
            "lng": config.LNG,
            "googleMapsUrl": config.GOOGLE_MAPS_URL,
            "wazeUrl": config.WAZE_URL,
        },
    }
