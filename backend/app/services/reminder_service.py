import asyncio
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import config
from app.models import Appointment, AppointmentStatus
from app.services.date_service import TZ
from app.services.email_service import EmailService


class ReminderService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.email = EmailService()

    async def process_due(self) -> dict:
        if not config.REMINDERS_ENABLED or not self.email.smtp_available():
            return {
                "enabled": False,
                "processed": 0,
                "skipped": 0,
                "status": "disabled",
            }

        now = datetime.now(TZ)
        window_end = now + timedelta(hours=config.REMINDER_LEAD_HOURS)
        result = await self.db.execute(
            select(Appointment)
            .where(
                Appointment.status.in_(
                    [
                        AppointmentStatus.pending,
                        AppointmentStatus.confirmed,
                    ]
                ),
                Appointment.starts_at > now,
                Appointment.starts_at <= window_end,
                Appointment.reminder_sent_at.is_(None),
            )
            .order_by(Appointment.starts_at.asc())
            .limit(config.REMINDER_BATCH_SIZE)
        )
        appointments = list(result.scalars().all())
        processed = 0
        skipped = 0

        for appointment in appointments:
            if not appointment.client_email:
                skipped += 1
                appointment.reminder_sent_at = now
                continue
            sent = await asyncio.to_thread(
                self.email.appointment_reminder,
                appointment,
            )
            if not sent:
                skipped += 1
                continue
            appointment.reminder_sent_at = now
            processed += 1

        await self.db.commit()
        return {
            "enabled": True,
            "processed": processed,
            "skipped": skipped,
            "status": "ok",
        }
