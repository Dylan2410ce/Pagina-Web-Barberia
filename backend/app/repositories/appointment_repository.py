from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Appointment, AppointmentStatus

ACTIVE = [AppointmentStatus.booked, AppointmentStatus.blocked, AppointmentStatus.present]


class AppointmentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def by_id(self, appointment_id) -> Appointment | None:
        result = await self.db.execute(
            select(Appointment).where(Appointment.id == appointment_id)
        )
        return result.scalar_one_or_none()

    async def list_by_barber(
        self,
        barber_id,
        start: datetime | None = None,
        end: datetime | None = None,
        active_only: bool = False,
        limit: int = 500,
    ) -> list[Appointment]:
        statement = select(Appointment).where(Appointment.barber_id == barber_id)
        if active_only:
            statement = statement.where(Appointment.status.in_(ACTIVE))
        if start and end:
            statement = statement.where(
                Appointment.starts_at < end,
                Appointment.ends_at > start,
            )
        result = await self.db.execute(
            statement.order_by(Appointment.starts_at.asc()).limit(limit)
        )
        return list(result.scalars().all())

    async def list_by_phone(
        self,
        phone: str,
        statuses: list[AppointmentStatus] | None = None,
        limit: int = 100,
    ) -> list[Appointment]:
        statement = select(Appointment).where(Appointment.client_phone == phone)
        if statuses:
            statement = statement.where(Appointment.status.in_(statuses))
        result = await self.db.execute(
            statement
            .order_by(Appointment.starts_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def has_overlap(
        self,
        barber_id,
        start: datetime,
        end: datetime,
        exclude_id=None,
    ) -> bool:
        statement = select(Appointment.id).where(
            Appointment.barber_id == barber_id,
            Appointment.status.in_(ACTIVE),
            Appointment.starts_at < end,
            Appointment.ends_at > start,
        )
        if exclude_id:
            statement = statement.where(Appointment.id != exclude_id)
        result = await self.db.execute(statement.limit(1))
        return result.scalar_one_or_none() is not None

    def save(self, appointment: Appointment) -> Appointment:
        self.db.add(appointment)
        return appointment
