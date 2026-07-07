from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Appointment, AppointmentStatus, Barber
from app.repositories.appointment_repository import AppointmentRepository
from app.schemas import AppointmentOut, BlockCreate, LoginIn, TokenOut
from app.services.appointment_service import AppointmentService
from app.services.auth_service import current_barber, login
from app.services.date_service import day_range

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.post("/login", response_model=TokenOut)
def admin_login(data: LoginIn, db: Session = Depends(get_db)):
    return {"token": login(db, data.username, data.password)}


@router.get("/me")
def me(barber: Barber = Depends(current_barber)):
    return {"id": barber.id, "name": barber.name, "role": barber.role}


@router.get("/appointments", response_model=list[AppointmentOut])
def appointments(
    day: date | None = Query(default=None, alias="date"),
    barber: Barber = Depends(current_barber),
    db: Session = Depends(get_db),
):
    start = end = None
    if day:
        start, end = day_range(day)
    return AppointmentRepository(db).list_by_barber(barber.id, start, end)


@router.patch("/appointments/{appointment_id}/status", response_model=AppointmentOut)
def update_status(
    appointment_id: UUID,
    status: AppointmentStatus,
    barber: Barber = Depends(current_barber),
    db: Session = Depends(get_db),
):
    return AppointmentService(db).update_status(appointment_id, barber.id, status.value)


@router.post("/blocks", response_model=AppointmentOut, status_code=201)
def create_block(
    data: BlockCreate,
    barber: Barber = Depends(current_barber),
    db: Session = Depends(get_db),
):
    return AppointmentService(db).create_block(barber.id, data)


@router.get("/stats")
def stats(
    year: int,
    month: int,
    barber: Barber = Depends(current_barber),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Appointment.status, func.count(Appointment.id), func.coalesce(func.sum(Appointment.total_price), 0))
        .filter(
            Appointment.barber_id == barber.id,
            extract("year", Appointment.starts_at) == year,
            extract("month", Appointment.starts_at) == month,
        )
        .group_by(Appointment.status)
        .all()
    )
    summary = {status.value: {"count": count, "income": int(income)} for status, count, income in rows}
    return {
        "appointments": sum(item["count"] for item in summary.values()),
        "attended": summary.get("present", {}).get("count", 0),
        "income": summary.get("present", {}).get("income", 0),
        "summary": summary,
    }

