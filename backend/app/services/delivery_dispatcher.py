"""Despacho persistente con presupuesto compartido y toma exclusiva de trabajos."""
import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.config import config
from app.models import (
    Appointment, AppointmentStatus, DispatchLease, NotificationBudget,
    NotificationDelivery, NotificationKind, NotificationStatus, WaitlistEntry, WaitlistStatus,
)
from app.services.emailjs_service import EmailJSError

logger = logging.getLogger("sebas_barber.delivery")


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def insert_for(db):
    return pg_insert if db.bind.dialect.name == "postgresql" else sqlite_insert


async def acquire_lease(db, owner):
    now = datetime.now(timezone.utc)
    stmt = insert_for(db)(DispatchLease).values(
        name="email-dispatch", owner=owner, expires_at=now + timedelta(minutes=2),
    ).on_conflict_do_update(
        index_elements=["name"],
        set_={"owner": owner, "expires_at": now + timedelta(minutes=2)},
        where=DispatchLease.expires_at <= now,
    ).returning(DispatchLease.owner)
    acquired = (await db.execute(stmt)).scalar_one_or_none() == owner
    await db.commit()
    return acquired


async def reserve_budget(db):
    period = datetime.now(timezone.utc).strftime("%Y-%m")
    if config.EMAIL_MONTHLY_LIMIT == 0:
        return False
    stmt = insert_for(db)(NotificationBudget).values(period=period, attempts=1)
    stmt = stmt.on_conflict_do_update(
        index_elements=["period"],
        set_={"attempts": NotificationBudget.attempts + 1},
        where=NotificationBudget.attempts < config.EMAIL_MONTHLY_LIMIT,
    ).returning(NotificationBudget.attempts)
    return (await db.execute(stmt)).scalar_one_or_none() is not None


async def dispatch_due(service):
    db = service.db
    result = dict(enabled=service.emailjs.available(), processed=0, skipped=0,
                  failed=0, uncertain=0, status="ok", daily_summaries=0, waitlist_notices=0)
    if not result["enabled"]:
        return {**result, "status": "disabled"}
    owner = str(uuid4())
    if not await acquire_lease(db, owner):
        return {**result, "status": "busy"}
    try:
        # Un corte tras enviar no permite saber si el proveedor acepto el correo.
        # No reintentar automaticamente ese caso: EmailJS no ofrece idempotencia.
        now = datetime.now(timezone.utc)
        await db.execute(update(NotificationDelivery).where(
            NotificationDelivery.status == NotificationStatus.processing,
            or_(NotificationDelivery.claimed_at.is_(None),
                NotificationDelivery.claimed_at < now - timedelta(minutes=2)),
        ).values(status=NotificationStatus.uncertain,
                 last_error="Resultado incierto tras interrupción; revisar EmailJS antes de reenviar."))
        await db.commit()
        if config.REMINDERS_ENABLED:
            await service.prepare_due_reminders()
        if config.DAILY_SUMMARIES_ENABLED:
            result["daily_summaries"] = await service.prepare_daily_summaries()
        deadline = time.monotonic() + 25
        for _ in range(min(config.REMINDER_BATCH_SIZE, 10)):
            if time.monotonic() >= deadline:
                break
            now = datetime.now(timezone.utc)
            renewed = await db.execute(update(DispatchLease).where(
                DispatchLease.name == "email-dispatch", DispatchLease.owner == owner,
                DispatchLease.expires_at > now,
            ).values(expires_at=now + timedelta(minutes=2)).returning(DispatchLease.owner))
            if renewed.scalar_one_or_none() is None:
                await db.rollback()
                break
            job = (await db.execute(
                select(NotificationDelivery).where(
                    NotificationDelivery.status.in_([NotificationStatus.pending, NotificationStatus.failed]),
                    NotificationDelivery.scheduled_for <= datetime.now(timezone.utc),
                    NotificationDelivery.attempts < config.NOTIFICATION_MAX_ATTEMPTS,
                ).order_by(NotificationDelivery.scheduled_for, NotificationDelivery.id)
                .limit(1).with_for_update(skip_locked=True)
            )).scalar_one_or_none()
            if job is None:
                await db.rollback()
                break
            appointment = await db.get(Appointment, job.appointment_id) if job.appointment_id else None
            if job.kind in {NotificationKind.appointment_created, NotificationKind.appointment_rescheduled} and job.appointment_id and (
                not appointment or appointment.status not in {AppointmentStatus.pending, AppointmentStatus.confirmed}
                or utc(appointment.starts_at) <= now
                or (job.payload.get("booking_start") and utc(datetime.fromisoformat(job.payload["booking_start"])) != utc(appointment.starts_at))
            ):
                job.status = NotificationStatus.skipped
                await db.commit()
                result["skipped"] += 1
                continue
            if job.kind == NotificationKind.appointment_reminder and (
                not config.REMINDERS_ENABLED or not appointment
                or appointment.status not in {AppointmentStatus.pending, AppointmentStatus.confirmed}
                or appointment.reminder_sent_at is not None
                or utc(appointment.starts_at) <= datetime.now(timezone.utc)
                or (utc(datetime.fromisoformat(job.payload["booking_start"]))
                    if job.payload.get("booking_start") else utc(job.scheduled_for) + timedelta(hours=config.REMINDER_LEAD_HOURS))
                    != utc(appointment.starts_at)
            ):
                job.status = NotificationStatus.skipped
                await db.commit()
                result["skipped"] += 1
                continue
            if not await reserve_budget(db):
                await db.rollback()
                result["status"] = "quota_exhausted"
                break
            job.status = NotificationStatus.processing
            # Normalizar mensajes heredados antes de enviarlos: sin adjuntos ni codigo en query.
            payload = {**job.payload, "qr_code": "", "has_qr": False}
            code = payload.get("access_code", "")
            if code.startswith("SB-"):
                from urllib.parse import quote
                payload["manage_url"] = config.FRONTEND_URL.rstrip("/") + "/#mis-citas?reserva=" + quote(code, safe="")
            job.payload = payload
            job.claimed_at = datetime.now(timezone.utc)
            job.attempts += 1
            await db.commit()
            try:
                await asyncio.to_thread(service.emailjs.send, job.template_id, job.payload)
                job.status = NotificationStatus.sent
                job.sent_at = datetime.now(timezone.utc)
                job.last_error = None
                result["processed"] += 1
                if appointment and job.kind == NotificationKind.appointment_reminder:
                    appointment.reminder_sent_at = job.sent_at
                    appointment.reminder_attempts = job.attempts
                    appointment.last_notification_error = None
                if job.kind == NotificationKind.waitlist_available:
                    result["waitlist_notices"] += 1
                    if job.waitlist_id:
                        entry = await db.get(WaitlistEntry, job.waitlist_id)
                        if entry and entry.status == WaitlistStatus.waiting:
                            entry.status = WaitlistStatus.contacted
                            entry.notified_at = job.sent_at
                            entry.notification_attempts = job.attempts
            except EmailJSError as exc:
                job.last_error = str(exc)
                if exc.uncertain:
                    job.status = NotificationStatus.uncertain
                    result["uncertain"] += 1
                else:
                    job.status = NotificationStatus.failed
                    if not exc.retryable:
                        job.attempts = config.NOTIFICATION_MAX_ATTEMPTS
                    job.scheduled_for = datetime.now(timezone.utc) + timedelta(minutes=min(2 ** job.attempts, 60))
                    result["failed"] += 1
                logger.warning("Entrega %s: %s", job.id, job.status.value)
            except Exception as exc:
                job.status = NotificationStatus.uncertain
                job.last_error = "Resultado incierto; revisar historial del proveedor."
                result["uncertain"] += 1
                logger.error("Entrega %s: %s", job.id, type(exc).__name__)
            await db.commit()
            await asyncio.sleep(1.1)
        return result
    finally:
        await db.rollback()
        await db.execute(update(DispatchLease).where(
            DispatchLease.name == "email-dispatch", DispatchLease.owner == owner,
        ).values(expires_at=datetime.now(timezone.utc)))
        await db.commit()
