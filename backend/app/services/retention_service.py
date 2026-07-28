import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import config
from app.models import (
    Appointment,
    AuditLog,
    Barber,
    ClientProfile,
    NotificationDelivery,
    WaitlistEntry,
)
from app.services.date_service import TZ
from app.services.calendar_service import CalendarError, CalendarService

logger = logging.getLogger("sebas_barber.retention")


class RetentionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def run(self) -> dict:
        cutoff = datetime.now(TZ) - timedelta(days=config.RETENTION_DAYS)
        appointments_result = await self.db.execute(
            select(Appointment).where(
                Appointment.starts_at < cutoff,
                or_(
                    Appointment.client_phone.not_like("anon-%"),
                    Appointment.calendar_event_id.is_not(None),
                ),
            )
        )
        appointments = list(appointments_result.scalars().all())
        barbers_result = await self.db.execute(select(Barber))
        barbers = {
            barber.id: barber
            for barber in barbers_result.scalars().all()
        }
        calendar = CalendarService()
        for appointment in appointments:
            barber = barbers.get(appointment.barber_id)
            calendar_deleted = True
            if (
                barber
                and barber.calendar_sync
                and barber.calendar_id
                and appointment.calendar_event_id
            ):
                try:
                    await asyncio.to_thread(
                        calendar.delete_event,
                        barber.calendar_id,
                        appointment.calendar_event_id,
                    )
                except CalendarError as exc:
                    calendar_deleted = False
                    logger.warning(
                        "No se pudo depurar el evento %s: %s",
                        appointment.id,
                        exc,
                    )
            suffix = str(appointment.id).replace("-", "")[:12]
            appointment.client_name = "Cliente anonimizado"
            appointment.client_phone = f"anon-{suffix}"
            appointment.client_email = None
            appointment.notes = None
            appointment.access_code_hash = None
            appointment.access_code_encrypted = None
            if calendar_deleted:
                appointment.calendar_event_id = None

        profiles_result = await self.db.execute(select(ClientProfile))
        profiles = list(profiles_result.scalars().all())
        anonymized_profiles = 0
        for profile in profiles:
            recent_result = await self.db.execute(
                select(func.max(Appointment.starts_at)).where(
                    Appointment.barber_id == profile.barber_id,
                    Appointment.client_phone == profile.phone,
                )
            )
            last_appointment = recent_result.scalar_one_or_none()
            if last_appointment and last_appointment >= cutoff:
                continue
            suffix = str(profile.id).replace("-", "")[:12]
            profile.name = "Cliente anonimizado"
            profile.phone = f"anon-{suffix}"
            profile.email = None
            profile.tags = []
            profile.preferences = None
            profile.internal_notes = None
            profile.anonymized_at = datetime.now(TZ)
            anonymized_profiles += 1

        audit_result = await self.db.execute(
            delete(AuditLog)
            .where(AuditLog.created_at < cutoff)
            .returning(AuditLog.id)
        )
        notification_result = await self.db.execute(
            delete(NotificationDelivery)
            .where(NotificationDelivery.created_at < cutoff)
            .returning(NotificationDelivery.id)
        )
        waitlist_result = await self.db.execute(
            delete(WaitlistEntry)
            .where(WaitlistEntry.desired_date < cutoff.date())
            .returning(WaitlistEntry.id)
        )
        await self.db.commit()
        return {
            "anonymized_appointments": len(appointments),
            "anonymized_profiles": anonymized_profiles,
            "deleted_audit_logs": len(audit_result.scalars().all()),
            "deleted_notifications": len(notification_result.scalars().all()),
            "deleted_waitlist_entries": len(waitlist_result.scalars().all()),
            "cutoff": cutoff,
        }
