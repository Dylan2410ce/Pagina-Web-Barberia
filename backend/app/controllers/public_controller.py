from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config import config
from app.database import get_db
from app.repositories.barber_repository import BarberRepository
from app.repositories.service_repository import ServiceRepository
from app.schemas import AppointmentCreate, AppointmentOut, BootstrapOut
from app.services.appointment_service import AppointmentService

router = APIRouter(prefix="/api/public", tags=["Public"])


@router.get("/init", response_model=BootstrapOut)
def init(db: Session = Depends(get_db)):
    barbers = BarberRepository(db).all_active()
    items = ServiceRepository(db).all_active()
    return {
        "barbers": barbers,
        "services": [item for item in items if not item.is_addon],
        "addons": [item for item in items if item.is_addon],
        "location": {
            "name": config.SHOP_NAME,
            "address": config.ADDRESS,
            "lat": config.LAT,
            "lng": config.LNG,
            "googleMapsUrl": config.GOOGLE_MAPS_URL,
            "wazeUrl": config.WAZE_URL,
        },
    }


@router.get("/availability")
def availability(
    barber_id: UUID,
    day: date = Query(alias="date"),
    service_id: UUID | None = None,
    addon_ids: list[UUID] = Query(default=[]),
    db: Session = Depends(get_db),
):
    service = AppointmentService(db)
    duration = 45
    if service_id:
        _, _, duration, _ = service.get_duration_and_price(service_id, addon_ids)
    return service.availability(barber_id, day, duration)


@router.post("/appointments", response_model=AppointmentOut, status_code=201)
def create_appointment(data: AppointmentCreate, db: Session = Depends(get_db)):
    return AppointmentService(db).create(data)

