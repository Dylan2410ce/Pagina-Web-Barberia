import asyncio
from collections import Counter
from datetime import date, datetime, timedelta
from hmac import compare_digest
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import extract, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import config
from app.database import get_db
from app.models import (
    Appointment,
    AppointmentStatus,
    AuditLog,
    AvailabilityException,
    Barber,
    BusinessHour,
    Service,
)
from app.repositories.appointment_repository import AppointmentRepository
from app.repositories.barber_repository import BarberRepository
from app.repositories.service_repository import ServiceRepository
from app.schemas import (
    AdminAppointmentReschedule,
    AppointmentOut,
    AuditLogOut,
    AvailabilityExceptionCreate,
    AvailabilityExceptionOut,
    BlockCreate,
    BusinessHourOut,
    BusinessHourUpdate,
    ClientOut,
    LoginIn,
    PasswordChangeIn,
    PasswordResetIn,
    QuickBlockCreate,
    ServiceCreate,
    ServiceOut,
    ServiceUpdate,
    TokenOut,
)
from app.services.appointment_service import AppointmentService
from app.services.audit_service import AuditService
from app.services.auth_service import current_barber, login
from app.services.calendar_service import calendar_embed_url
from app.services.date_service import TZ, day_range, range_from_minutes
from app.services.password_service import hash_password, verify_password
from app.services.service_cache import service_cache

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.post("/login", response_model=TokenOut)
async def admin_login(data: LoginIn, db: AsyncSession = Depends(get_db)):
    return {"token": await login(db, data.username, data.password)}


@router.post("/reset-password")
async def reset_password(data: PasswordResetIn, db: AsyncSession = Depends(get_db)):
    if not compare_digest(data.master_code, config.MASTER_RESET_CODE):
        raise HTTPException(status_code=401, detail="Código maestro inválido")

    barber = await BarberRepository(db).by_username(data.username)
    if not barber:
        raise HTTPException(status_code=404, detail="Barbero no encontrado")

    barber.password_hash = await asyncio.to_thread(hash_password, data.new_password)
    barber.credentials_initialized = True
    AuditService(db).record(
        barber_id=barber.id,
        action="security.password_reset",
        entity_type="barber",
        entity_id=barber.id,
        details={"actor": "master_code"},
    )
    await db.commit()
    return {"ok": True, "message": "Contraseña actualizada"}


@router.post("/change-password")
async def change_password(
    data: PasswordChangeIn,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    password_ok = await asyncio.to_thread(
        verify_password,
        data.current_password,
        barber.password_hash,
    )
    if not password_ok:
        raise HTTPException(status_code=401, detail="La contraseña actual no es correcta")

    barber.password_hash = await asyncio.to_thread(hash_password, data.new_password)
    barber.credentials_initialized = True
    AuditService(db).record(
        barber_id=barber.id,
        action="security.password_changed",
        entity_type="barber",
        entity_id=barber.id,
        details={"actor": "admin"},
    )
    await db.commit()
    return {"ok": True, "message": "Contraseña actualizada"}


@router.get("/me")
async def me(barber: Barber = Depends(current_barber)):
    return {
        "id": barber.id,
        "name": barber.name,
        "username": barber.username,
        "role": barber.role,
        "phone": barber.phone,
        "calendar_sync": barber.calendar_sync,
        "calendar_connected": bool(barber.calendar_sync and barber.calendar_id),
        "calendar_embed_url": calendar_embed_url(barber.calendar_id),
    }


@router.get("/dashboard")
async def dashboard(
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(TZ)
    today = now.date()
    today_start, today_end = day_range(today)
    week_start_day = today - timedelta(days=today.weekday())
    week_end_day = week_start_day + timedelta(days=7)
    week_start, _ = day_range(week_start_day)
    week_end, _ = day_range(week_end_day)
    week_items = await AppointmentRepository(db).list_by_barber(
        barber.id,
        week_start,
        week_end,
    )
    today_items = [
        item
        for item in week_items
        if today_start <= item.starts_at < today_end
    ]
    active_today = [
        item
        for item in today_items
        if item.status
        in [
            AppointmentStatus.pending,
            AppointmentStatus.confirmed,
            AppointmentStatus.completed,
        ]
    ]
    pending_today = [
        item
        for item in today_items
        if item.status
        in [AppointmentStatus.pending, AppointmentStatus.confirmed]
    ]
    completed_today = [
        item for item in today_items
        if item.status == AppointmentStatus.completed
    ]
    visible_week = [
        item
        for item in week_items
        if item.status
        in [
            AppointmentStatus.pending,
            AppointmentStatus.confirmed,
            AppointmentStatus.completed,
            AppointmentStatus.no_show,
        ]
    ]
    completed_week = [
        item for item in week_items
        if item.status == AppointmentStatus.completed
    ]
    pending_week = [
        item
        for item in week_items
        if item.status
        in [AppointmentStatus.pending, AppointmentStatus.confirmed]
    ]
    top_service_week = Counter(
        item.service_name for item in visible_week
    ).most_common(1)

    upcoming_result = await db.execute(
        select(Appointment)
        .where(
            Appointment.barber_id == barber.id,
            Appointment.status.in_(
                [
                    AppointmentStatus.pending,
                    AppointmentStatus.confirmed,
                ]
            ),
            Appointment.starts_at >= now,
        )
        .order_by(Appointment.starts_at.asc())
        .limit(6)
    )
    upcoming = list(upcoming_result.scalars().all())

    return {
        "today": today,
        "appointments_today": len(active_today),
        "completed_today": len(completed_today),
        "pending_today": len(pending_today),
        "income_today": sum(item.total_price for item in completed_today),
        "projected_today": sum(
            item.total_price for item in pending_today + completed_today
        ),
        "appointments_week": len(visible_week),
        "completed_week": len(completed_week),
        "income_week": sum(item.total_price for item in completed_week),
        "projected_week": sum(
            item.total_price for item in pending_week + completed_week
        ),
        "top_service_week": top_service_week[0][0] if top_service_week else "",
        "upcoming": [AppointmentOut.model_validate(item) for item in upcoming],
    }


@router.get("/appointments", response_model=list[AppointmentOut])
async def appointments(
    day: date | None = Query(default=None, alias="date"),
    status: AppointmentStatus | None = Query(default=None),
    q: str | None = Query(default=None, max_length=80),
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    start = end = None
    if day:
        start, end = day_range(day)
    return await AppointmentRepository(db).list_by_barber(
        barber.id,
        start,
        end,
        status=status,
        query=q,
    )


@router.patch("/appointments/{appointment_id}/status", response_model=AppointmentOut)
async def update_status(
    appointment_id: UUID,
    status: AppointmentStatus,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    return await AppointmentService(db).update_status(
        appointment_id,
        barber.id,
        status.value,
    )


@router.patch("/appointments/{appointment_id}/reschedule", response_model=AppointmentOut)
async def admin_reschedule(
    appointment_id: UUID,
    data: AdminAppointmentReschedule,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    return await AppointmentService(db).reschedule_by_admin(
        appointment_id,
        barber.id,
        data.date,
        data.start_min,
    )


@router.post("/blocks", response_model=AppointmentOut, status_code=201)
async def create_block(
    data: BlockCreate,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    return await AppointmentService(db).create_block(barber.id, data)


@router.post(
    "/blocks/next-available",
    response_model=AppointmentOut,
    status_code=201,
)
async def create_next_available_block(
    data: QuickBlockCreate,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    return await AppointmentService(db).create_next_available_block(
        barber.id,
        data,
    )


@router.get("/blocks", response_model=list[AppointmentOut])
async def list_blocks(
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment)
        .where(
            Appointment.barber_id == barber.id,
            Appointment.status == AppointmentStatus.blocked,
            Appointment.ends_at >= datetime.now(TZ),
        )
        .order_by(Appointment.starts_at.asc())
        .limit(50)
    )
    return list(result.scalars().all())


@router.get("/services", response_model=list[ServiceOut])
async def services(
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    return await ServiceRepository(db).all()


@router.post("/services", response_model=ServiceOut, status_code=201)
async def create_service(
    data: ServiceCreate,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    service = Service(
        name=data.name,
        duration_min=0 if data.is_addon else data.duration_min,
        base_price=max(data.price - 1000, 0),
        price=data.price,
        is_addon=data.is_addon,
        is_active=data.is_active,
    )
    ServiceRepository(db).save(service)
    try:
        await db.flush()
        AuditService(db).record(
            barber_id=barber.id,
            action="service.created",
            entity_type="service",
            entity_id=service.id,
            details={"name": service.name, "price": service.price},
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Ya existe un servicio con ese nombre",
        ) from exc
    await db.refresh(service)
    service_cache.invalidate()
    return service


@router.patch("/services/{service_id}", response_model=ServiceOut)
async def update_service(
    service_id: UUID,
    data: ServiceUpdate,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    service = await ServiceRepository(db).by_id_any(service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    payload = data.model_dump(exclude_unset=True)
    next_is_addon = payload.get("is_addon", service.is_addon)
    next_duration = payload.get("duration_min", service.duration_min)
    if not next_is_addon and next_duration <= 0:
        raise HTTPException(
            status_code=400,
            detail="Un servicio principal necesita una duración",
        )
    if next_is_addon:
        payload["duration_min"] = 0
    for field, value in payload.items():
        setattr(service, field, value)
    if "price" in payload:
        service.base_price = max(service.price - 1000, 0)
    AuditService(db).record(
        barber_id=barber.id,
        action="service.updated",
        entity_type="service",
        entity_id=service.id,
        details={"fields": sorted(payload)},
    )
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Ya existe un servicio con ese nombre",
        ) from exc
    await db.refresh(service)
    service_cache.invalidate()
    return service


@router.get("/business-hours", response_model=list[BusinessHourOut])
async def business_hours(
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BusinessHour)
        .where(BusinessHour.barber_id == barber.id)
        .order_by(BusinessHour.weekday.asc())
    )
    return list(result.scalars().all())


@router.put("/business-hours/{weekday}", response_model=BusinessHourOut)
async def update_business_hour(
    weekday: int,
    data: BusinessHourUpdate,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    if weekday != data.weekday:
        raise HTTPException(status_code=400, detail="El día de la ruta no coincide")
    if data.is_open and data.close_min <= data.open_min:
        raise HTTPException(
            status_code=400,
            detail="La hora de cierre debe ser mayor a la apertura",
        )

    result = await db.execute(
        select(BusinessHour).where(
            BusinessHour.barber_id == barber.id,
            BusinessHour.weekday == weekday,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        item = BusinessHour(barber_id=barber.id, weekday=weekday)
        db.add(item)
    item.is_open = data.is_open
    item.open_min = data.open_min
    item.close_min = data.close_min
    AuditService(db).record(
        barber_id=barber.id,
        action="business_hours.updated",
        entity_type="business_hour",
        entity_id=item.id,
        details={
            "weekday": weekday,
            "is_open": data.is_open,
            "open_min": data.open_min,
            "close_min": data.close_min,
        },
    )
    await db.commit()
    await db.refresh(item)
    return item


@router.get(
    "/availability-exceptions",
    response_model=list[AvailabilityExceptionOut],
)
async def availability_exceptions(
    include_past: bool = Query(default=False),
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    statement = select(AvailabilityException).where(
        AvailabilityException.barber_id == barber.id
    )
    if not include_past:
        statement = statement.where(
            AvailabilityException.end_date >= datetime.now(TZ).date()
        )
    result = await db.execute(
        statement.order_by(
            AvailabilityException.start_date.asc(),
            AvailabilityException.start_min.asc().nullsfirst(),
        ).limit(100)
    )
    return list(result.scalars().all())


@router.post(
    "/availability-exceptions",
    response_model=AvailabilityExceptionOut,
    status_code=201,
)
async def create_availability_exception(
    data: AvailabilityExceptionCreate,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    if data.end_date < datetime.now(TZ).date():
        raise HTTPException(
            status_code=400,
            detail="No se pueden crear ausencias en fechas pasadas",
        )
    appointment_service = AppointmentService(db)
    day = data.start_date
    while day <= data.end_date:
        await appointment_service.lock_schedule(barber.id, day)
        day += timedelta(days=1)

    if data.all_day:
        period_start, _ = day_range(data.start_date)
        _, period_end = day_range(data.end_date)
    else:
        period_start, period_end = range_from_minutes(
            data.start_date,
            data.start_min,
            data.end_min - data.start_min,
        )
    conflicts_result = await db.execute(
        select(func.count(Appointment.id)).where(
            Appointment.barber_id == barber.id,
            Appointment.status.in_(
                [
                    AppointmentStatus.pending,
                    AppointmentStatus.confirmed,
                ]
            ),
            Appointment.starts_at < period_end,
            Appointment.ends_at > period_start,
        )
    )
    conflicts = conflicts_result.scalar_one()
    if conflicts:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Hay {conflicts} cita{'s' if conflicts != 1 else ''} activa"
                f"{'s' if conflicts != 1 else ''} en ese periodo. "
                "Reprograma o cancela esas citas antes de guardar la ausencia."
            ),
        )

    item = AvailabilityException(
        barber_id=barber.id,
        start_date=data.start_date,
        end_date=data.end_date,
        start_min=None if data.all_day else data.start_min,
        end_min=None if data.all_day else data.end_min,
        kind=data.kind,
        title=data.title,
        notes=data.notes,
    )
    db.add(item)
    await db.flush()
    AuditService(db).record(
        barber_id=barber.id,
        action="availability.created",
        entity_type="availability_exception",
        entity_id=item.id,
        details={
            "kind": item.kind.value,
            "start_date": item.start_date.isoformat(),
            "end_date": item.end_date.isoformat(),
            "all_day": item.all_day,
        },
    )
    await db.commit()
    await db.refresh(item)
    return item


@router.delete(
    "/availability-exceptions/{exception_id}",
    status_code=204,
)
async def delete_availability_exception(
    exception_id: UUID,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AvailabilityException).where(
            AvailabilityException.id == exception_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Ausencia no encontrada")
    if item.barber_id != barber.id:
        raise HTTPException(
            status_code=403,
            detail="No tienes permiso para modificar la agenda de otro barbero",
        )
    AuditService(db).record(
        barber_id=barber.id,
        action="availability.deleted",
        entity_type="availability_exception",
        entity_id=item.id,
        details={"title": item.title},
    )
    await db.delete(item)
    await db.commit()
    return Response(status_code=204)


@router.get("/audit-logs", response_model=list[AuditLogOut])
async def audit_logs(
    limit: int = Query(default=60, ge=1, le=200),
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.barber_id == barber.id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


@router.get("/clients", response_model=list[ClientOut])
async def clients(
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment)
        .where(
            Appointment.barber_id == barber.id,
            Appointment.status != AppointmentStatus.blocked,
        )
        .order_by(Appointment.starts_at.desc())
    )
    rows = list(result.scalars().all())
    grouped = {}
    for item in rows:
        client = grouped.setdefault(
            item.client_phone,
            {
                "name": item.client_name,
                "phone": item.client_phone,
                "email": item.client_email,
                "appointments": 0,
                "completed_appointments": 0,
                "spent": 0,
                "last_visit": None,
                "last_service": None,
                "favorite_service": None,
                "frequency_days": None,
                "history": [],
                "_completed_dates": [],
                "_services": Counter(),
            },
        )
        client["appointments"] += 1
        if item.status == AppointmentStatus.completed:
            client["completed_appointments"] += 1
            client["spent"] += item.total_price
            client["_completed_dates"].append(item.starts_at)
            client["_services"][item.service_name] += 1
            if not client["last_visit"]:
                client["last_visit"] = item.starts_at
                client["last_service"] = item.service_name
        client["history"].append(
            {
                "id": item.id,
                "service": item.service_name,
                "addons": item.addons,
                "status": item.status,
                "starts_at": item.starts_at,
                "total_price": item.total_price,
                "notes": item.notes,
            }
        )
    for client in grouped.values():
        completed_dates = sorted(client.pop("_completed_dates"))
        services = client.pop("_services")
        if services:
            client["favorite_service"] = services.most_common(1)[0][0]
        if len(completed_dates) > 1:
            differences = [
                (current - previous).days
                for previous, current in zip(
                    completed_dates,
                    completed_dates[1:],
                )
            ]
            client["frequency_days"] = round(
                sum(differences) / len(differences)
            )

    return sorted(
        grouped.values(),
        key=lambda item: item["appointments"],
        reverse=True,
    )


@router.get("/stats")
async def stats(
    year: int,
    month: int,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    local_start = func.timezone("America/Costa_Rica", Appointment.starts_at)
    date_filters = (
        Appointment.barber_id == barber.id,
        extract("year", local_start) == year,
        extract("month", local_start) == month,
    )

    rows_result = await db.execute(
        select(
            Appointment.status,
            func.count(Appointment.id),
            func.coalesce(func.sum(Appointment.total_price), 0),
        )
        .where(*date_filters)
        .group_by(Appointment.status)
    )
    rows = rows_result.all()

    services_result = await db.execute(
        select(
            Appointment.service_name,
            func.count(Appointment.id),
            func.coalesce(func.sum(Appointment.total_price), 0),
        )
        .where(
            *date_filters,
            Appointment.status.in_(
                [
                    AppointmentStatus.pending,
                    AppointmentStatus.confirmed,
                    AppointmentStatus.completed,
                ]
            ),
        )
        .group_by(Appointment.service_name)
        .order_by(func.count(Appointment.id).desc())
    )
    services_rows = services_result.all()

    daily_result = await db.execute(
        select(
            extract("day", local_start).label("day"),
            func.count(Appointment.id),
            func.coalesce(func.sum(Appointment.total_price), 0),
        )
        .where(
            *date_filters,
            Appointment.status == AppointmentStatus.completed,
        )
        .group_by("day")
        .order_by("day")
    )
    daily = daily_result.all()

    summary = {
        status.value: {"count": count, "income": int(income)}
        for status, count, income in rows
    }
    appointments_total = sum(item["count"] for item in summary.values())
    attended = summary.get("completed", {}).get("count", 0)
    pending = summary.get("pending", {}).get("count", 0)
    confirmed = summary.get("confirmed", {}).get("count", 0)
    booked = pending + confirmed
    noshow = summary.get("no_show", {}).get("count", 0)
    cancelled = summary.get("cancelled", {}).get("count", 0)
    income = summary.get("completed", {}).get("income", 0)
    projected = (
        summary.get("pending", {}).get("income", 0)
        + summary.get("confirmed", {}).get("income", 0)
        + income
    )

    return {
        "appointments": appointments_total,
        "attended": attended,
        "noshow": noshow,
        "booked": booked,
        "cancelled": cancelled,
        "income": income,
        "projected_income": projected,
        "average_ticket": round(income / attended) if attended else 0,
        "attendance_rate": round(
            (attended / max(attended + noshow, 1)) * 100
        ),
        "completion_rate": round(
            (attended / max(appointments_total, 1)) * 100
        ),
        "cancellation_rate": round(
            (cancelled / max(appointments_total, 1)) * 100
        ),
        "top_service": services_rows[0][0] if services_rows else "",
        "service_breakdown": [
            {"name": name, "count": count, "income": int(total)}
            for name, count, total in services_rows
        ],
        "daily_income": [
            {"day": int(day), "count": count, "income": int(total)}
            for day, count, total in daily
        ],
        "summary": summary,
    }
