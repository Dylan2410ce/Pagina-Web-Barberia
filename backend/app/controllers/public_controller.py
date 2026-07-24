from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config import config
from app.database import get_db
from app.models import BusinessHour
from app.repositories.barber_repository import BarberRepository
from app.repositories.service_repository import ServiceRepository
from app.schemas import (
    AppointmentCancel,
    AppointmentCreate,
    AppointmentOut,
    AppointmentReschedule,
    BootstrapOut,
    SlotOut,
)
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
        "business_hours": db.query(BusinessHour).order_by(BusinessHour.weekday.asc()).all(),
        "location": {
            "name": config.SHOP_NAME,
            "address": config.ADDRESS,
            "lat": config.LAT,
            "lng": config.LNG,
            "googleMapsUrl": config.GOOGLE_MAPS_URL,
            "wazeUrl": config.WAZE_URL,
        },
    }


@router.get("/availability", response_model=list[SlotOut])
def availability(
    barber_id: UUID,
    day: date = Query(alias="date"),
    service_id: UUID | None = None,
    addon_ids: list[UUID] = Query(default_factory=list),
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


@router.get("/appointments/by-phone", response_model=list[AppointmentOut])
def appointments_by_phone(phone: str = Query(pattern=r"^[24678][0-9]{7}$"), db: Session = Depends(get_db)):
    return AppointmentService(db).list_by_phone(phone)


@router.patch("/appointments/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(appointment_id: UUID, data: AppointmentCancel, db: Session = Depends(get_db)):
    return AppointmentService(db).cancel_by_client(appointment_id, data.phone, data.reason)


@router.patch("/appointments/{appointment_id}/reschedule", response_model=AppointmentOut)
def reschedule_appointment(appointment_id: UUID, data: AppointmentReschedule, db: Session = Depends(get_db)):
    return AppointmentService(db).reschedule_by_client(appointment_id, data.phone, data.date, data.start_min)
