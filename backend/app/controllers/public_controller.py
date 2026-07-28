from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.config import config
from app.database import get_db
from app.models import Barber, BusinessBreak, BusinessHour, GalleryItem, Promotion
from app.repositories.barber_repository import BarberRepository
from app.schemas import BootstrapOut, ServiceOut, ShopStatusOut
from app.services.engagement_service import EngagementService
from app.services.service_cache import service_cache
from app.services.shop_status_service import ShopStatusService

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
    breaks_result = await db.execute(
        select(BusinessBreak)
        .join(Barber, Barber.id == BusinessBreak.barber_id)
        .where(
            Barber.is_active.is_(True),
            BusinessBreak.is_active.is_(True),
        )
        .order_by(BusinessBreak.barber_id, BusinessBreak.weekday)
    )
    promotions_result = await db.execute(
        select(Promotion)
        .join(Barber, Barber.id == Promotion.barber_id)
        .where(
            Barber.is_active.is_(True),
            Promotion.is_active.is_(True),
        )
        .order_by(Promotion.start_date.asc())
        .limit(50)
    )
    gallery_result = await db.execute(
        select(GalleryItem, Barber.name)
        .join(Barber, Barber.id == GalleryItem.barber_id)
        .where(
            GalleryItem.is_active.is_(True),
            Barber.is_active.is_(True),
        )
        .order_by(GalleryItem.display_order.asc(), GalleryItem.created_at.asc())
        .limit(24)
    )
    gallery = [
        {
            "id": item.id,
            "barber_id": item.barber_id,
            "barber_name": barber_name,
            "image_url": item.image_url,
            "title": item.title,
            "alt_text": item.alt_text,
            "category": item.category,
            "description": item.description,
            "display_order": item.display_order,
            "is_active": item.is_active,
            "created_at": item.created_at,
        }
        for item, barber_name in gallery_result.all()
    ]
    reviews = await EngagementService(db).public_reviews(limit=8)

    return {
        "barbers": barbers,
        "services": [item for item in items if not item.is_addon],
        "addons": [item for item in items if item.is_addon],
        "business_hours": business_hours,
        "business_breaks": list(breaks_result.scalars().all()),
        "promotions": list(promotions_result.scalars().all()),
        "reviews": reviews["items"],
        "gallery": gallery,
        "location": {
            "name": config.SHOP_NAME,
            "address": config.ADDRESS,
            "lat": config.LAT,
            "lng": config.LNG,
            "googleMapsUrl": config.GOOGLE_MAPS_URL,
            "wazeUrl": config.WAZE_URL,
            "parkingInfo": config.PARKING_INFO,
            "directionsHint": config.DIRECTIONS_HINT,
        },
    }


@router.get("/shop-status/{barber_id}", response_model=ShopStatusOut)
async def shop_status(
    barber_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    return await ShopStatusService(db).status(barber_id)
