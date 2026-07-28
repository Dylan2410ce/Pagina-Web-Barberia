from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import (
    AppointmentCancel,
    AppointmentCreate,
    AppointmentCreatedOut,
    AppointmentOut,
    AppointmentReschedule,
    SlotOut,
)
from app.services.appointment_service import AppointmentService

router = APIRouter(prefix="/api/public", tags=["Bookings"])


@router.get("/availability", response_model=list[SlotOut])
async def availability(
    barber_id: UUID,
    day: date = Query(alias="date"),
    service_id: UUID | None = None,
    addon_ids: list[UUID] = Query(default_factory=list),
    db: AsyncSession = Depends(get_db),
):
    service = AppointmentService(db)
    duration = 45
    if service_id:
        _, _, duration, _ = await service.get_duration_and_price(service_id, addon_ids)
    return await service.availability(barber_id, day, duration)


@router.post("/appointments", response_model=AppointmentCreatedOut, status_code=201)
async def create_appointment(
    data: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
):
    return await AppointmentService(db).create(data)


@router.get("/appointments/manage/{access_code}", response_model=AppointmentOut)
async def appointment_by_access_code(
    access_code: str,
    db: AsyncSession = Depends(get_db),
):
    return await AppointmentService(db).get_by_access_code(access_code)


@router.get(
    "/appointments/history/{access_code}",
    response_model=list[AppointmentOut],
)
async def appointment_history(
    access_code: str,
    db: AsyncSession = Depends(get_db),
):
    return await AppointmentService(db).history_by_access_code(access_code)


@router.get("/appointments/by-phone", response_model=list[AppointmentOut])
async def appointments_by_phone(
    phone: str = Query(pattern=r"^[24678][0-9]{7}$"),
    db: AsyncSession = Depends(get_db),
):
    return await AppointmentService(db).list_by_phone(phone)


@router.patch("/appointments/{appointment_id}/cancel", response_model=AppointmentOut)
async def cancel_appointment(
    appointment_id: UUID,
    data: AppointmentCancel,
    db: AsyncSession = Depends(get_db),
):
    return await AppointmentService(db).cancel_by_client(
        appointment_id=appointment_id,
        phone=data.phone,
        access_code=data.access_code,
        reason=data.reason,
    )


@router.patch("/appointments/{appointment_id}/reschedule", response_model=AppointmentOut)
async def reschedule_appointment(
    appointment_id: UUID,
    data: AppointmentReschedule,
    db: AsyncSession = Depends(get_db),
):
    return await AppointmentService(db).reschedule_by_client(
        appointment_id=appointment_id,
        phone=data.phone,
        access_code=data.access_code,
        day=data.date,
        start_min=data.start_min,
    )
