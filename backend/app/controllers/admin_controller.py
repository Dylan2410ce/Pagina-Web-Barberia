from datetime import date, datetime
from hmac import compare_digest
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.config import config
from app.database import get_db
from app.models import Appointment, AppointmentStatus, Barber, BusinessHour, Service
from app.repositories.appointment_repository import AppointmentRepository
from app.repositories.barber_repository import BarberRepository
from app.repositories.service_repository import ServiceRepository
from app.schemas import (
    AdminAppointmentReschedule,
    AppointmentOut,
    BlockCreate,
    BusinessHourOut,
    BusinessHourUpdate,
    LoginIn,
    PasswordResetIn,
    ServiceCreate,
    ServiceOut,
    ServiceUpdate,
    TokenOut,
)
from app.services.appointment_service import AppointmentService
from app.services.auth_service import current_barber, login
from app.services.date_service import day_range
from app.services.password_service import hash_password

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.post("/login", response_model=TokenOut)
def admin_login(data: LoginIn, db: Session = Depends(get_db)):
    return {"token": login(db, data.username, data.password)}


@router.post("/reset-password")
def reset_password(data: PasswordResetIn, db: Session = Depends(get_db)):
    if not compare_digest(data.master_code, config.MASTER_RESET_CODE):
        raise HTTPException(status_code=401, detail="Codigo maestro invalido")

    barber = BarberRepository(db).by_username(data.username)
    if not barber:
        raise HTTPException(status_code=404, detail="Barbero no encontrado")

    barber.password_hash = hash_password(data.new_password)
    db.commit()
    return {"ok": True, "message": "Password actualizado"}


@router.get("/me")
def me(barber: Barber = Depends(current_barber)):
    return {"id": barber.id, "name": barber.name, "role": barber.role}


@router.get("/dashboard")
def dashboard(barber: Barber = Depends(current_barber), db: Session = Depends(get_db)):
    today = datetime.now(ZoneInfo("America/Costa_Rica")).date()
    start, end = day_range(today)
    today_items = AppointmentRepository(db).list_by_barber(barber.id, start, end)
    active_today = [item for item in today_items if item.status in [AppointmentStatus.booked, AppointmentStatus.present]]
    booked_today = [item for item in today_items if item.status == AppointmentStatus.booked]
    completed_today = [item for item in today_items if item.status == AppointmentStatus.present]
    projected = sum(item.total_price for item in booked_today + completed_today)
    income = sum(item.total_price for item in completed_today)

    upcoming = (
        db.query(Appointment)
        .filter(
            Appointment.barber_id == barber.id,
            Appointment.status == AppointmentStatus.booked,
            Appointment.starts_at >= datetime.now(ZoneInfo("America/Costa_Rica")),
        )
        .order_by(Appointment.starts_at.asc())
        .limit(6)
        .all()
    )

    return {
        "today": today,
        "appointments_today": len(active_today),
        "completed_today": len(completed_today),
        "pending_today": len(booked_today),
        "income_today": income,
        "projected_today": projected,
        "upcoming": [AppointmentOut.model_validate(item) for item in upcoming],
    }


@router.get("/appointments", response_model=list[AppointmentOut])
def appointments(
    day: date | None = Query(default=None, alias="date"),
    status: AppointmentStatus | None = Query(default=None),
    q: str | None = Query(default=None, max_length=80),
    barber: Barber = Depends(current_barber),
    db: Session = Depends(get_db),
):
    start = end = None
    if day:
        start, end = day_range(day)
    items = AppointmentRepository(db).list_by_barber(barber.id, start, end)
    if status:
        items = [item for item in items if item.status == status]
    if q:
        term = q.lower().strip()
        items = [
            item
            for item in items
            if term in item.client_name.lower()
            or term in item.client_phone
            or term in item.service_name.lower()
        ]
    return items


@router.patch("/appointments/{appointment_id}/status", response_model=AppointmentOut)
def update_status(
    appointment_id: UUID,
    status: AppointmentStatus,
    barber: Barber = Depends(current_barber),
    db: Session = Depends(get_db),
):
    return AppointmentService(db).update_status(appointment_id, barber.id, status.value)


@router.patch("/appointments/{appointment_id}/reschedule", response_model=AppointmentOut)
def admin_reschedule(
    appointment_id: UUID,
    data: AdminAppointmentReschedule,
    barber: Barber = Depends(current_barber),
    db: Session = Depends(get_db),
):
    return AppointmentService(db).reschedule_by_admin(appointment_id, barber.id, data.date, data.start_min)


@router.post("/blocks", response_model=AppointmentOut, status_code=201)
def create_block(
    data: BlockCreate,
    barber: Barber = Depends(current_barber),
    db: Session = Depends(get_db),
):
    return AppointmentService(db).create_block(barber.id, data)


@router.get("/services", response_model=list[ServiceOut])
def services(barber: Barber = Depends(current_barber), db: Session = Depends(get_db)):
    return ServiceRepository(db).all()


@router.post("/services", response_model=ServiceOut, status_code=201)
def create_service(data: ServiceCreate, barber: Barber = Depends(current_barber), db: Session = Depends(get_db)):
    service = Service(
        name=data.name,
        duration_min=0 if data.is_addon else data.duration_min,
        base_price=max(data.price - 1000, 0),
        price=data.price,
        is_addon=data.is_addon,
        is_active=data.is_active,
    )
    ServiceRepository(db).save(service)
    db.commit()
    db.refresh(service)
    return service


@router.patch("/services/{service_id}", response_model=ServiceOut)
def update_service(
    service_id: UUID,
    data: ServiceUpdate,
    barber: Barber = Depends(current_barber),
    db: Session = Depends(get_db),
):
    service = ServiceRepository(db).by_id_any(service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    payload = data.model_dump(exclude_unset=True)
    next_is_addon = payload.get("is_addon", service.is_addon)
    next_duration = payload.get("duration_min", service.duration_min)
    if not next_is_addon and next_duration <= 0:
        raise HTTPException(status_code=400, detail="Un servicio principal necesita una duracion")
    if next_is_addon:
        payload["duration_min"] = 0
    for field, value in payload.items():
        setattr(service, field, value)
    if "price" in payload:
        service.base_price = max(service.price - 1000, 0)
    db.commit()
    db.refresh(service)
    return service


@router.get("/business-hours", response_model=list[BusinessHourOut])
def business_hours(barber: Barber = Depends(current_barber), db: Session = Depends(get_db)):
    return db.query(BusinessHour).order_by(BusinessHour.weekday.asc()).all()


@router.put("/business-hours/{weekday}", response_model=BusinessHourOut)
def update_business_hour(
    weekday: int,
    data: BusinessHourUpdate,
    barber: Barber = Depends(current_barber),
    db: Session = Depends(get_db),
):
    if weekday != data.weekday:
        raise HTTPException(status_code=400, detail="El dia de la ruta no coincide")
    if data.is_open and data.close_min <= data.open_min:
        raise HTTPException(status_code=400, detail="La hora de cierre debe ser mayor a la apertura")

    item = db.query(BusinessHour).filter(BusinessHour.weekday == weekday).first()
    if not item:
        item = BusinessHour(weekday=weekday)
        db.add(item)
    item.is_open = data.is_open
    item.open_min = data.open_min
    item.close_min = data.close_min
    db.commit()
    db.refresh(item)
    return item


@router.get("/clients")
def clients(barber: Barber = Depends(current_barber), db: Session = Depends(get_db)):
    rows = (
        db.query(Appointment)
        .filter(Appointment.barber_id == barber.id, Appointment.status != AppointmentStatus.blocked)
        .order_by(Appointment.starts_at.desc())
        .all()
    )
    grouped = {}
    for item in rows:
        client = grouped.setdefault(
            item.client_phone,
            {
                "name": item.client_name,
                "phone": item.client_phone,
                "email": item.client_email,
                "appointments": 0,
                "spent": 0,
                "last_visit": None,
                "history": [],
            },
        )
        client["appointments"] += 1
        if item.status == AppointmentStatus.present:
            client["spent"] += item.total_price
        if not client["last_visit"]:
            client["last_visit"] = item.starts_at
        client["history"].append(
            {
                "id": item.id,
                "service": item.service_name,
                "status": item.status,
                "starts_at": item.starts_at,
                "total_price": item.total_price,
            }
        )
    return sorted(grouped.values(), key=lambda item: item["appointments"], reverse=True)


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
    cancelled = summary.get("cancelled", {}).get("count", 0)
    income = summary.get("present", {}).get("income", 0)
    projected = summary.get("booked", {}).get("income", 0) + income
    avg_ticket = round(income / attended) if attended else 0
    attendance_rate = round((attended / max(attended + noshow, 1)) * 100)
    completion_rate = round((attended / max(appointments, 1)) * 100)
    cancellation_rate = round((cancelled / max(appointments, 1)) * 100)
    top_service = services[0][0] if services else ""

    return {
        "appointments": appointments,
        "attended": attended,
        "noshow": noshow,
        "booked": booked,
        "cancelled": cancelled,
        "income": income,
        "projected_income": projected,
        "average_ticket": avg_ticket,
        "attendance_rate": attendance_rate,
        "completion_rate": completion_rate,
        "cancellation_rate": cancellation_rate,
        "top_service": top_service,
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
