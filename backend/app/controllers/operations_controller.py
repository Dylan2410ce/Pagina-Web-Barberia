import asyncio
from datetime import date, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    Appointment,
    AppointmentFeedback,
    AppointmentStatus,
    AuditLog,
    Barber,
    BusinessBreak,
    BusinessHour,
    CashClose,
    ClientProfile,
    Expense,
    NotificationDelivery,
    Promotion,
    Review,
    Service,
    WaitlistEntry,
)
from app.schemas import (
    BarberOut,
    BarberSettingsUpdate,
    BusinessBreakCreate,
    BusinessBreakOut,
    CashCloseCreate,
    CashCloseOut,
    ClientProfileUpdate,
    ExpenseCreate,
    ExpenseOut,
    FeedbackOut,
    NotificationOut,
    PromotionCreate,
    PromotionOut,
    PromotionUpdate,
)
from app.services.audit_service import AuditService
from app.services.auth_service import current_barber
from app.services.calendar_service import CalendarError, CalendarService
from app.services.date_service import TZ, day_range

router = APIRouter(prefix="/api/admin", tags=["Operations"])


def _owned(item, barber: Barber, label: str):
    if not item:
        raise HTTPException(status_code=404, detail=f"{label} no encontrado")
    if item.barber_id != barber.id:
        raise HTTPException(
            status_code=403,
            detail="No tienes permiso para acceder a datos de otro barbero",
        )
    return item


@router.get("/settings", response_model=BarberOut)
async def settings(barber: Barber = Depends(current_barber)):
    return barber


@router.patch("/settings", response_model=BarberOut)
async def update_settings(
    data: BarberSettingsUpdate,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    payload = data.model_dump()
    for field, value in payload.items():
        setattr(barber, field, value)
    AuditService(db).record(
        barber_id=barber.id,
        action="settings.updated",
        entity_type="barber",
        entity_id=barber.id,
        details={"fields": sorted(payload)},
    )
    await db.commit()
    await db.refresh(barber)
    return barber


@router.get("/business-breaks", response_model=list[BusinessBreakOut])
async def business_breaks(
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BusinessBreak)
        .where(
            BusinessBreak.barber_id == barber.id,
            BusinessBreak.is_active.is_(True),
        )
        .order_by(BusinessBreak.weekday, BusinessBreak.start_min)
    )
    return list(result.scalars().all())


@router.post("/business-breaks", response_model=BusinessBreakOut, status_code=201)
async def create_business_break(
    data: BusinessBreakCreate,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    hours_result = await db.execute(
        select(BusinessHour).where(
            BusinessHour.barber_id == barber.id,
            BusinessHour.weekday == data.weekday,
        )
    )
    hours = hours_result.scalar_one_or_none()
    if not hours or not hours.is_open:
        raise HTTPException(
            status_code=409,
            detail="No puedes agregar una pausa en un día cerrado",
        )
    if data.start_min < hours.open_min or data.end_min > hours.close_min:
        raise HTTPException(
            status_code=409,
            detail="La pausa debe quedar dentro del horario de atención",
        )
    overlap_result = await db.execute(
        select(BusinessBreak.id).where(
            BusinessBreak.barber_id == barber.id,
            BusinessBreak.weekday == data.weekday,
            BusinessBreak.is_active.is_(True),
            BusinessBreak.start_min < data.end_min,
            BusinessBreak.end_min > data.start_min,
        )
    )
    if overlap_result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="La pausa se cruza con otra ya configurada",
        )
    item = BusinessBreak(barber_id=barber.id, **data.model_dump())
    db.add(item)
    await db.flush()
    AuditService(db).record(
        barber_id=barber.id,
        action="business_break.created",
        entity_type="business_break",
        entity_id=item.id,
        details={"weekday": item.weekday, "label": item.label},
    )
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/business-breaks/{break_id}", status_code=204)
async def delete_business_break(
    break_id: UUID,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    item = _owned(
        await db.get(BusinessBreak, break_id),
        barber,
        "Pausa",
    )
    AuditService(db).record(
        barber_id=barber.id,
        action="business_break.deleted",
        entity_type="business_break",
        entity_id=item.id,
        details={"weekday": item.weekday, "label": item.label},
    )
    item.is_active = False
    await db.commit()
    return Response(status_code=204)


@router.patch("/client-profiles/{profile_id}")
async def update_client_profile(
    profile_id: UUID,
    data: ClientProfileUpdate,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    profile = _owned(
        await db.get(ClientProfile, profile_id),
        barber,
        "Cliente",
    )
    for field, value in data.model_dump().items():
        setattr(profile, field, value)
    AuditService(db).record(
        barber_id=barber.id,
        action="client_profile.updated",
        entity_type="client_profile",
        entity_id=profile.id,
        details={"fields": ["tags", "preferences", "internal_notes"]},
    )
    await db.commit()
    return {"ok": True}


@router.post("/client-profiles/{profile_id}/anonymize")
async def anonymize_client(
    profile_id: UUID,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    profile = _owned(
        await db.get(ClientProfile, profile_id),
        barber,
        "Cliente",
    )
    suffix = str(profile.id).replace("-", "")[:10]
    appointments_result = await db.execute(
        select(Appointment).where(
            Appointment.barber_id == barber.id,
            Appointment.client_phone == profile.phone,
        )
    )
    appointments = list(appointments_result.scalars().all())
    if any(
        appointment.status in {
            AppointmentStatus.pending,
            AppointmentStatus.confirmed,
        }
        and appointment.starts_at >= datetime.now(TZ)
        for appointment in appointments
    ):
        raise HTTPException(
            status_code=409,
            detail="Cancela o completa las citas activas antes de eliminar los datos",
        )
    appointment_ids = [appointment.id for appointment in appointments]
    calendar = CalendarService()
    for appointment in appointments:
        if barber.calendar_sync and appointment.calendar_event_id:
            try:
                await asyncio.to_thread(
                    calendar.delete_event,
                    barber.calendar_id,
                    appointment.calendar_event_id,
                )
            except CalendarError as exc:
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "Google Calendar no respondió. No se eliminaron "
                        "los datos; intenta nuevamente."
                    ),
                ) from exc
        appointment.client_name = "Cliente eliminado"
        appointment.client_phone = f"anon{suffix}"
        appointment.client_email = None
        appointment.notes = None
        appointment.access_code_encrypted = None
        appointment.access_code_hash = None
        appointment.calendar_event_id = None
    reviews_result = await db.execute(
        select(Review).where(
            Review.barber_id == barber.id,
            Review.appointment_id.in_(appointment_ids),
        )
    ) if appointment_ids else None
    if reviews_result:
        for review in reviews_result.scalars().all():
            review.client_name = "Cliente"
    notifications_result = await db.execute(
        select(NotificationDelivery).where(
            NotificationDelivery.barber_id == barber.id,
            NotificationDelivery.appointment_id.in_(appointment_ids),
        )
    ) if appointment_ids else None
    if notifications_result:
        for notification in notifications_result.scalars().all():
            await db.delete(notification)
    waitlist_result = await db.execute(
        select(WaitlistEntry).where(
            WaitlistEntry.barber_id == barber.id,
            WaitlistEntry.client_phone == profile.phone,
        )
    )
    for entry in waitlist_result.scalars().all():
        await db.delete(entry)
    profile.name = "Cliente eliminado"
    profile.phone = f"anon{suffix}"
    profile.email = None
    profile.tags = []
    profile.preferences = None
    profile.internal_notes = None
    profile.anonymized_at = datetime.now(TZ)
    AuditService(db).record(
        barber_id=barber.id,
        action="client_profile.anonymized",
        entity_type="client_profile",
        entity_id=profile.id,
        details={},
    )
    await db.commit()
    return {"ok": True}


@router.get("/feedback", response_model=list[FeedbackOut])
async def feedback(
    limit: int = Query(default=100, ge=1, le=300),
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AppointmentFeedback)
        .where(AppointmentFeedback.barber_id == barber.id)
        .order_by(AppointmentFeedback.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


@router.get("/promotions", response_model=list[PromotionOut])
async def promotions(
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Promotion)
        .where(Promotion.barber_id == barber.id)
        .order_by(Promotion.start_date.desc())
    )
    return list(result.scalars().all())


@router.post("/promotions", response_model=PromotionOut, status_code=201)
async def create_promotion(
    data: PromotionCreate,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    if data.service_id and not await db.get(Service, data.service_id):
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    promotion = Promotion(barber_id=barber.id, **data.model_dump())
    db.add(promotion)
    await db.flush()
    AuditService(db).record(
        barber_id=barber.id,
        action="promotion.created",
        entity_type="promotion",
        entity_id=promotion.id,
        details={"name": promotion.name},
    )
    await db.commit()
    await db.refresh(promotion)
    return promotion


@router.patch("/promotions/{promotion_id}", response_model=PromotionOut)
async def update_promotion(
    promotion_id: UUID,
    data: PromotionUpdate,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    promotion = _owned(
        await db.get(Promotion, promotion_id),
        barber,
        "Promoción",
    )
    payload = data.model_dump(exclude_unset=True)
    start_date = payload.get("start_date", promotion.start_date)
    end_date = payload.get("end_date", promotion.end_date)
    if end_date < start_date:
        raise HTTPException(
            status_code=422,
            detail="La fecha final debe ser posterior a la inicial",
        )
    for field, value in payload.items():
        setattr(promotion, field, value)
    AuditService(db).record(
        barber_id=barber.id,
        action="promotion.updated",
        entity_type="promotion",
        entity_id=promotion.id,
        details={"fields": sorted(payload)},
    )
    await db.commit()
    await db.refresh(promotion)
    return promotion


@router.delete("/promotions/{promotion_id}", status_code=204)
async def delete_promotion(
    promotion_id: UUID,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    promotion = _owned(
        await db.get(Promotion, promotion_id),
        barber,
        "Promoción",
    )
    AuditService(db).record(
        barber_id=barber.id,
        action="promotion.deleted",
        entity_type="promotion",
        entity_id=promotion.id,
        details={"name": promotion.name},
    )
    await db.delete(promotion)
    await db.commit()
    return Response(status_code=204)


@router.get("/expenses", response_model=list[ExpenseOut])
async def expenses(
    date_from: date | None = None,
    date_to: date | None = None,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    statement = select(Expense).where(Expense.barber_id == barber.id)
    if date_from:
        statement = statement.where(Expense.expense_date >= date_from)
    if date_to:
        statement = statement.where(Expense.expense_date <= date_to)
    result = await db.execute(
        statement.order_by(Expense.expense_date.desc()).limit(500)
    )
    return list(result.scalars().all())


@router.post("/expenses", response_model=ExpenseOut, status_code=201)
async def create_expense(
    data: ExpenseCreate,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    item = Expense(barber_id=barber.id, **data.model_dump())
    db.add(item)
    await db.flush()
    AuditService(db).record(
        barber_id=barber.id,
        action="expense.created",
        entity_type="expense",
        entity_id=item.id,
        details={"amount": item.amount, "category": item.category},
    )
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/expenses/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: UUID,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    item = _owned(await db.get(Expense, expense_id), barber, "Gasto")
    AuditService(db).record(
        barber_id=barber.id,
        action="expense.deleted",
        entity_type="expense",
        entity_id=item.id,
        details={"amount": item.amount, "category": item.category},
    )
    await db.delete(item)
    await db.commit()
    return Response(status_code=204)


async def _cash_totals(
    db: AsyncSession,
    barber_id: UUID,
    business_date: date,
) -> tuple[int, int]:
    start, end = day_range(business_date)
    income_result = await db.execute(
        select(func.coalesce(func.sum(Appointment.total_price), 0)).where(
            Appointment.barber_id == barber_id,
            Appointment.status == AppointmentStatus.completed,
            Appointment.starts_at >= start,
            Appointment.starts_at < end,
        )
    )
    expense_result = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.barber_id == barber_id,
            Expense.expense_date == business_date,
        )
    )
    return int(income_result.scalar_one()), int(expense_result.scalar_one())


@router.get("/cash-closes", response_model=list[CashCloseOut])
async def cash_closes(
    limit: int = Query(default=60, ge=1, le=366),
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CashClose)
        .where(CashClose.barber_id == barber.id)
        .order_by(CashClose.business_date.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


@router.post("/cash-closes", response_model=CashCloseOut, status_code=201)
async def create_cash_close(
    data: CashCloseCreate,
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    if data.business_date > datetime.now(TZ).date():
        raise HTTPException(
            status_code=422,
            detail="No se puede cerrar una fecha futura",
        )
    gross, expenses_total = await _cash_totals(
        db,
        barber.id,
        data.business_date,
    )
    item = CashClose(
        barber_id=barber.id,
        business_date=data.business_date,
        gross_income=gross,
        expenses_total=expenses_total,
        net_income=gross - expenses_total,
        notes=data.notes,
    )
    db.add(item)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Ese día ya tiene un cierre registrado",
        ) from exc
    AuditService(db).record(
        barber_id=barber.id,
        action="cash_close.created",
        entity_type="cash_close",
        entity_id=item.id,
        details={"net_income": item.net_income},
    )
    await db.commit()
    await db.refresh(item)
    return item


@router.get("/notifications", response_model=list[NotificationOut])
async def notifications(
    limit: int = Query(default=100, ge=1, le=300),
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NotificationDelivery)
        .where(NotificationDelivery.barber_id == barber.id)
        .order_by(NotificationDelivery.scheduled_for.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


@router.get("/operations-metrics")
async def operations_metrics(
    days: int = Query(default=30, ge=1, le=366),
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    end_day = datetime.now(TZ).date()
    start_day = end_day - timedelta(days=days - 1)
    start, _ = day_range(start_day)
    _, end = day_range(end_day)
    appointments_result = await db.execute(
        select(Appointment).where(
            Appointment.barber_id == barber.id,
            Appointment.starts_at >= start,
            Appointment.starts_at < end,
            Appointment.status != AppointmentStatus.blocked,
        )
    )
    appointments = list(appointments_result.scalars().all())
    expenses_result = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.barber_id == barber.id,
            Expense.expense_date >= start_day,
            Expense.expense_date <= end_day,
        )
    )
    expenses_total = int(expenses_result.scalar_one())
    completed = [
        item for item in appointments
        if item.status == AppointmentStatus.completed
    ]
    gross = sum(item.total_price for item in completed)
    client_counts: dict[str, int] = {}
    for item in completed:
        client_counts[item.client_phone] = client_counts.get(item.client_phone, 0) + 1
    repeat_clients = sum(1 for count in client_counts.values() if count > 1)
    feedback_result = await db.execute(
        select(
            func.coalesce(func.avg(AppointmentFeedback.satisfaction), 0),
            func.coalesce(func.avg(AppointmentFeedback.booking_ease), 0),
        ).where(AppointmentFeedback.barber_id == barber.id)
    )
    satisfaction, booking_ease = feedback_result.one()
    return {
        "period": {"from": start_day, "to": end_day, "days": days},
        "gross_income": gross,
        "expenses": expenses_total,
        "net_income": gross - expenses_total,
        "completed": len(completed),
        "cancelled": sum(
            item.status == AppointmentStatus.cancelled for item in appointments
        ),
        "no_show": sum(
            item.status == AppointmentStatus.no_show for item in appointments
        ),
        "unique_clients": len(client_counts),
        "repeat_clients": repeat_clients,
        "repeat_rate": round(
            repeat_clients / max(len(client_counts), 1) * 100
        ),
        "average_satisfaction": round(float(satisfaction), 1),
        "average_booking_ease": round(float(booking_ease), 1),
    }


@router.get("/operations-overview")
async def operations_overview(
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    queries = {
        "breaks": (
            select(BusinessBreak)
            .where(
                BusinessBreak.barber_id == barber.id,
                BusinessBreak.is_active.is_(True),
            )
            .order_by(BusinessBreak.weekday, BusinessBreak.start_min)
        ),
        "promotions": (
            select(Promotion)
            .where(Promotion.barber_id == barber.id)
            .order_by(Promotion.start_date.desc())
            .limit(100)
        ),
        "expenses": (
            select(Expense)
            .where(Expense.barber_id == barber.id)
            .order_by(Expense.expense_date.desc())
            .limit(100)
        ),
        "cash_closes": (
            select(CashClose)
            .where(CashClose.barber_id == barber.id)
            .order_by(CashClose.business_date.desc())
            .limit(60)
        ),
        "notifications": (
            select(NotificationDelivery)
            .where(NotificationDelivery.barber_id == barber.id)
            .order_by(NotificationDelivery.scheduled_for.desc())
            .limit(60)
        ),
        "feedback": (
            select(AppointmentFeedback)
            .where(AppointmentFeedback.barber_id == barber.id)
            .order_by(AppointmentFeedback.created_at.desc())
            .limit(100)
        ),
    }
    results = {}
    for key, statement in queries.items():
        result = await db.execute(statement)
        results[key] = list(result.scalars().all())
    return {
        "settings": BarberOut.model_validate(barber),
        "breaks": [
            BusinessBreakOut.model_validate(item)
            for item in results["breaks"]
        ],
        "promotions": [
            PromotionOut.model_validate(item)
            for item in results["promotions"]
        ],
        "expenses": [
            ExpenseOut.model_validate(item)
            for item in results["expenses"]
        ],
        "cash_closes": [
            CashCloseOut.model_validate(item)
            for item in results["cash_closes"]
        ],
        "notifications": [
            NotificationOut.model_validate(item)
            for item in results["notifications"]
        ],
        "feedback": [
            FeedbackOut.model_validate(item)
            for item in results["feedback"]
        ],
        "metrics": await operations_metrics(
            days=30,
            barber=barber,
            db=db,
        ),
    }


@router.get("/backup")
async def backup(
    barber: Barber = Depends(current_barber),
    db: AsyncSession = Depends(get_db),
):
    tables = {
        "appointments": Appointment,
        "clients": ClientProfile,
        "expenses": Expense,
        "cash_closes": CashClose,
        "promotions": Promotion,
        "audit_logs": AuditLog,
    }
    payload = {
        "generated_at": datetime.now(TZ).isoformat(),
        "barber": {
            "id": str(barber.id),
            "name": barber.name,
            "username": barber.username,
        },
        "data": {},
    }
    for key, model in tables.items():
        result = await db.execute(
            select(model).where(model.barber_id == barber.id)
        )
        payload["data"][key] = [
            {
                column.name: (
                    value.isoformat()
                    if isinstance(value, (date, datetime))
                    else str(value)
                    if isinstance(value, UUID)
                    else value.value
                    if hasattr(value, "value")
                    else value
                )
                for column in model.__table__.columns
                if column.name
                not in {
                    "access_code_hash",
                    "access_code_encrypted",
                    "request_fingerprint",
                }
                for value in [getattr(item, column.name)]
            }
            for item in result.scalars().all()
        ]
    return payload
