import asyncio
import logging
from datetime import date, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import config
from app.models import (
    Appointment,
    AppointmentStatus,
    Barber,
    NotificationDelivery,
    NotificationKind,
    NotificationStatus,
    WaitlistEntry,
    WaitlistStatus,
)
from app.services.date_service import TZ, day_range, label_from_minutes
from app.services.emailjs_service import EmailJSService
from app.services.idempotency_service import decrypt_access_code

logger = logging.getLogger("sebas_barber.notifications")

DAYS_ES = (
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
    "domingo",
)
MONTHS_ES = (
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
)


def spanish_datetime(value: datetime) -> str:
    local = value.astimezone(TZ)
    time_text = local.strftime("%I:%M %p").lstrip("0")
    return (
        f"{DAYS_ES[local.weekday()]} {local.day} de "
        f"{MONTHS_ES[local.month - 1]} a las {time_text}"
    )


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.emailjs = EmailJSService()

    async def _exists(self, dedupe_key: str) -> bool:
        result = await self.db.execute(
            select(NotificationDelivery.id).where(
                NotificationDelivery.dedupe_key == dedupe_key
            )
        )
        return result.scalar_one_or_none() is not None

    async def enqueue_reminder(
        self,
        appointment: Appointment,
        barber: Barber,
    ) -> bool:
        if not appointment.client_email or appointment.status not in {
            AppointmentStatus.pending,
            AppointmentStatus.confirmed,
        }:
            return False
        dedupe_key = f"reminder:{appointment.id}:{appointment.starts_at.isoformat()}"
        if await self._exists(dedupe_key):
            return False
        now = datetime.now(TZ)
        scheduled_for = appointment.starts_at.astimezone(TZ) - timedelta(
            hours=config.REMINDER_LEAD_HOURS
        )
        if appointment.starts_at.astimezone(TZ) <= now + timedelta(hours=1):
            return False
        if scheduled_for <= now:
            return False
        access_code = decrypt_access_code(appointment.access_code_encrypted)
        appointment.access_code = access_code or ""
        date_text = spanish_datetime(appointment.starts_at)
        total_text = f"₡{appointment.total_price:,.0f}".replace(",", " ")
        message = (
            f"Hola {appointment.client_name}.\n\n"
            f"Te recordamos que mañana tienes una cita en {config.SHOP_NAME}.\n\n"
            f"Barbero: {barber.name}\n"
            f"Servicio: {appointment.service_name}\n"
            f"Fecha y hora: {date_text}\n"
            f"Total: {total_text}\n\n"
            f"Ubicación: {config.ADDRESS}\n"
            f"Google Maps: {config.GOOGLE_MAPS_URL}\n"
            f"Waze: {config.WAZE_URL}\n\n"
            "Llega unos minutos antes para comenzar a tiempo.\n\n"
            "Seguridad: Sebas Barber nunca solicita contraseñas ni pagos "
            "mediante enlaces enviados por correo."
        )
        payload = self.emailjs.appointment_payload(
            appointment,
            barber,
            notification_type="appointment_reminder",
            title="Recordatorio de tu cita",
            message=message,
            to_email=appointment.client_email,
        )
        self.db.add(
            NotificationDelivery(
                barber_id=barber.id,
                appointment_id=appointment.id,
                kind=NotificationKind.appointment_reminder,
                status=NotificationStatus.pending,
                dedupe_key=dedupe_key,
                recipient_email=appointment.client_email,
                template_id=config.EMAILJS_TEMPLATE_CLIENTE,
                payload=payload,
                scheduled_for=scheduled_for,
            )
        )
        return True

    async def refresh_reminder(
        self,
        appointment: Appointment,
        barber: Barber,
    ) -> None:
        result = await self.db.execute(
            select(NotificationDelivery).where(
                NotificationDelivery.appointment_id == appointment.id,
                NotificationDelivery.kind == NotificationKind.appointment_reminder,
                NotificationDelivery.status.in_(
                    [
                        NotificationStatus.pending,
                        NotificationStatus.failed,
                        NotificationStatus.processing,
                    ]
                ),
            )
        )
        for job in result.scalars().all():
            job.status = NotificationStatus.skipped
            job.last_error = "La cita cambió después de programar el recordatorio"
        appointment.reminder_sent_at = None
        appointment.reminder_attempts = 0
        appointment.last_notification_error = None
        await self.enqueue_reminder(appointment, barber)

    async def cancel_reminders(
        self,
        appointment: Appointment,
        reason: str = "La cita fue cancelada",
    ) -> None:
        result = await self.db.execute(
            select(NotificationDelivery).where(
                NotificationDelivery.appointment_id == appointment.id,
                NotificationDelivery.kind == NotificationKind.appointment_reminder,
                NotificationDelivery.status.in_(
                    [
                        NotificationStatus.pending,
                        NotificationStatus.failed,
                        NotificationStatus.processing,
                    ]
                ),
            )
        )
        for job in result.scalars().all():
            job.status = NotificationStatus.skipped
            job.last_error = reason

    async def enqueue_waitlist_release(
        self,
        barber: Barber,
        released_date: date,
    ) -> int:
        result = await self.db.execute(
            select(WaitlistEntry)
            .where(
                WaitlistEntry.barber_id == barber.id,
                WaitlistEntry.desired_date == released_date,
                WaitlistEntry.status == WaitlistStatus.waiting,
                WaitlistEntry.client_email.is_not(None),
            )
            .order_by(WaitlistEntry.created_at.asc())
            .limit(5)
        )
        entries = list(result.scalars().all())
        created = 0
        for entry in entries:
            dedupe_key = f"waitlist:{entry.id}:{released_date.isoformat()}"
            if await self._exists(dedupe_key):
                continue
            reserve_url = f"{config.FRONTEND_URL.rstrip('/')}/#reserva"
            message = (
                f"Hola {entry.client_name}.\n\n"
                f"Se liberó un espacio con {barber.name} para el "
                f"{released_date.strftime('%d/%m/%Y')}.\n\n"
                f"Servicio solicitado: {entry.service_name}\n"
                f"Reserva aquí: {reserve_url}\n\n"
                "El espacio sigue disponible para otras personas hasta que "
                "la reserva quede confirmada."
            )
            payload = {
                "notification_type": "waitlist_available",
                "to_email": entry.client_email,
                "recipient_name": entry.client_name,
                "reply_to": barber.email or config.OWNER_EMAIL,
                "from_name": config.SHOP_NAME,
                "shop_name": config.SHOP_NAME,
                "email_subject": "Se liberó un espacio en Sebas Barber",
                "email_title": "Hay una hora disponible",
                "email_message": message,
                "barber_name": barber.name,
                "barber": barber.name,
                "client_name": entry.client_name,
                "customer_name": entry.client_name,
                "client_phone": entry.client_phone,
                "phone": entry.client_phone,
                "client_email": entry.client_email,
                "service_name": entry.service_name,
                "service": entry.service_name,
                "appointment_date": released_date.strftime("%d/%m/%Y"),
                "appointment_time": "Consulta la agenda",
                "appointment_datetime": released_date.strftime("%d/%m/%Y"),
                "total_price": "Según el servicio",
                "total": "Según el servicio",
                "manage_url": reserve_url,
                "maps_url": config.GOOGLE_MAPS_URL,
                "waze_url": config.WAZE_URL,
                "location": config.ADDRESS,
            }
            self.db.add(
                NotificationDelivery(
                    barber_id=barber.id,
                    waitlist_id=entry.id,
                    kind=NotificationKind.waitlist_available,
                    status=NotificationStatus.pending,
                    dedupe_key=dedupe_key,
                    recipient_email=entry.client_email,
                    template_id=config.EMAILJS_TEMPLATE_CLIENTE,
                    payload=payload,
                    scheduled_for=datetime.now(TZ),
                )
            )
            created += 1
        return created

    async def prepare_due_reminders(self) -> int:
        now = datetime.now(TZ)
        horizon = now + timedelta(
            hours=config.REMINDER_LEAD_HOURS,
            minutes=15,
        )
        result = await self.db.execute(
            select(Appointment, Barber)
            .join(Barber, Barber.id == Appointment.barber_id)
            .where(
                Appointment.status.in_(
                    [AppointmentStatus.pending, AppointmentStatus.confirmed]
                ),
                Appointment.client_email.is_not(None),
                Appointment.reminder_sent_at.is_(None),
                Appointment.starts_at > now,
                Appointment.starts_at <= horizon,
            )
            .order_by(Appointment.starts_at.asc())
            .limit(config.REMINDER_BATCH_SIZE)
        )
        created = 0
        for appointment, barber in result.all():
            created += int(await self.enqueue_reminder(appointment, barber))
        await self.db.commit()
        return created

    async def prepare_daily_summaries(self) -> int:
        now = datetime.now(TZ)
        if (
            now.hour < config.DAILY_SUMMARY_HOUR
            or not config.EMAILJS_TEMPLATE_BARBERO
        ):
            return 0
        result = await self.db.execute(
            select(Barber).where(
                Barber.is_active.is_(True),
                Barber.daily_summary_enabled.is_(True),
                Barber.email.is_not(None),
            )
        )
        created = 0
        for barber in result.scalars().all():
            dedupe_key = f"daily-summary:{barber.id}:{now.date().isoformat()}"
            if await self._exists(dedupe_key):
                continue
            start, end = day_range(now.date())
            appointments_result = await self.db.execute(
                select(Appointment)
                .where(
                    Appointment.barber_id == barber.id,
                    Appointment.starts_at >= start,
                    Appointment.starts_at < end,
                    Appointment.status.in_(
                        [
                            AppointmentStatus.pending,
                            AppointmentStatus.confirmed,
                        ]
                    ),
                )
                .order_by(Appointment.starts_at.asc())
            )
            appointments = list(appointments_result.scalars().all())
            lines = [
                f"{label_from_minutes(item.starts_at.astimezone(TZ).hour * 60 + item.starts_at.astimezone(TZ).minute)}"
                f" · {item.client_name} · {item.service_name}"
                for item in appointments
            ]
            message = (
                f"Agenda de {barber.name} para hoy, "
                f"{now.strftime('%d/%m/%Y')}.\n\n"
                + ("\n".join(lines) if lines else "No hay citas pendientes para hoy.")
                + f"\n\nTotal de citas: {len(appointments)}"
            )
            payload = {
                "notification_type": "daily_summary",
                "to_email": barber.email,
                "recipient_name": barber.name,
                "reply_to": barber.email,
                "from_name": config.SHOP_NAME,
                "shop_name": config.SHOP_NAME,
                "email_subject": f"Agenda de hoy: {len(appointments)} citas",
                "email_title": "Resumen diario de agenda",
                "email_message": message,
                "barber_name": barber.name,
                "barber": barber.name,
                "appointment_date": now.strftime("%d/%m/%Y"),
                "appointment_time": "Resumen del día",
                "service_name": f"{len(appointments)} citas",
                "client_name": "Agenda diaria",
                "client_phone": "No aplica",
                "total_price": "Consulta el panel",
                "manage_url": f"{config.FRONTEND_URL.rstrip('/')}/admin",
            }
            self.db.add(
                NotificationDelivery(
                    barber_id=barber.id,
                    kind=NotificationKind.daily_summary,
                    status=NotificationStatus.pending,
                    dedupe_key=dedupe_key,
                    recipient_email=barber.email,
                    template_id=config.EMAILJS_TEMPLATE_BARBERO,
                    payload=payload,
                    scheduled_for=now,
                )
            )
            created += 1
        await self.db.commit()
        return created

    async def process_due(self) -> dict:
        if not config.REMINDERS_ENABLED or not self.emailjs.available():
            return {
                "enabled": False,
                "processed": 0,
                "skipped": 0,
                "failed": 0,
                "status": "disabled",
                "daily_summaries": 0,
                "waitlist_notices": 0,
            }

        await self.prepare_due_reminders()
        daily_created = await self.prepare_daily_summaries()
        now = datetime.now(TZ)
        result = await self.db.execute(
            select(NotificationDelivery)
            .where(
                NotificationDelivery.scheduled_for <= now,
                NotificationDelivery.attempts < config.NOTIFICATION_MAX_ATTEMPTS,
                or_(
                    NotificationDelivery.status.in_(
                        [NotificationStatus.pending, NotificationStatus.failed]
                    ),
                    NotificationDelivery.status == NotificationStatus.processing,
                ),
            )
            .order_by(NotificationDelivery.scheduled_for.asc())
            .limit(config.REMINDER_BATCH_SIZE)
        )
        jobs = list(result.scalars().all())
        processed = 0
        failed = 0
        skipped = 0
        waitlist_notices = 0

        for job in jobs:
            job.status = NotificationStatus.processing
            job.attempts += 1
            await self.db.commit()
            try:
                await asyncio.to_thread(
                    self.emailjs.send,
                    job.template_id,
                    job.payload,
                )
                job.status = NotificationStatus.sent
                job.sent_at = datetime.now(TZ)
                job.last_error = None
                processed += 1
                if job.kind == NotificationKind.appointment_reminder:
                    appointment = await self.db.get(
                        Appointment,
                        job.appointment_id,
                    )
                    if appointment:
                        appointment.reminder_sent_at = job.sent_at
                        appointment.reminder_attempts = job.attempts
                        appointment.last_notification_error = None
                elif job.kind == NotificationKind.waitlist_available:
                    entry = await self.db.get(WaitlistEntry, job.waitlist_id)
                    if entry:
                        entry.notified_at = job.sent_at
                        entry.notification_attempts = job.attempts
                        entry.status = WaitlistStatus.contacted
                    waitlist_notices += 1
            except Exception as exc:
                logger.exception(
                    "No se pudo enviar la notificación %s",
                    job.id,
                    exc_info=exc,
                )
                job.status = NotificationStatus.failed
                job.last_error = str(exc)[:500]
                job.scheduled_for = datetime.now(TZ) + timedelta(
                    minutes=min(2 ** job.attempts, 30)
                )
                failed += 1
                if job.appointment_id:
                    appointment = await self.db.get(
                        Appointment,
                        job.appointment_id,
                    )
                    if appointment:
                        appointment.reminder_attempts = job.attempts
                        appointment.last_notification_error = job.last_error
            await self.db.commit()

        return {
            "enabled": True,
            "processed": processed,
            "skipped": skipped,
            "failed": failed,
            "status": "ok",
            "daily_summaries": daily_created,
            "waitlist_notices": waitlist_notices,
        }
