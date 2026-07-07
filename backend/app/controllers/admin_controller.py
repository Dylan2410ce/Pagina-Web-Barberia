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
    services = (
        db.query(
            Appointment.service_name,
            func.count(Appointment.id),
            func.coalesce(func.sum(Appointment.total_price), 0),
        )
        .filter(
            Appointment.barber_id == barber.id,
            extract("year", Appointment.starts_at) == year,
            extract("month", Appointment.starts_at) == month,
            Appointment.status.in_([AppointmentStatus.booked, AppointmentStatus.present]),
        )
        .group_by(Appointment.service_name)
        .order_by(func.count(Appointment.id).desc())
        .all()
    )
    daily = (
        db.query(
            extract("day", Appointment.starts_at).label("day"),
            func.count(Appointment.id),
            func.coalesce(func.sum(Appointment.total_price), 0),
        )
        .filter(
            Appointment.barber_id == barber.id,
            extract("year", Appointment.starts_at) == year,
            extract("month", Appointment.starts_at) == month,
            Appointment.status == AppointmentStatus.present,
        )
        .group_by("day")
        .order_by("day")
        .all()
    )

    summary = {status.value: {"count": count, "income": int(income)} for status, count, income in rows}
    appointments = sum(item["count"] for item in summary.values())
    attended = summary.get("present", {}).get("count", 0)
    booked = summary.get("booked", {}).get("count", 0)
    noshow = summary.get("noshow", {}).get("count", 0)
    income = summary.get("present", {}).get("income", 0)
    projected = summary.get("booked", {}).get("income", 0) + income
    avg_ticket = round(income / attended) if attended else 0
    attendance_rate = round((attended / max(attended + noshow, 1)) * 100)

    return {
        "appointments": appointments,
        "attended": attended,
        "noshow": noshow,
        "booked": booked,
        "cancelled": summary.get("cancelled", {}).get("count", 0),
        "income": income,
        "projected_income": projected,
        "average_ticket": avg_ticket,
        "attendance_rate": attendance_rate,
        "service_breakdown": [
            {"name": name, "count": count, "income": int(total)}
            for name, count, total in services
        ],
        "daily_income": [
            {"day": int(day), "count": count, "income": int(total)}
            for day, count, total in daily
        ],
        "summary": summary,
    }
