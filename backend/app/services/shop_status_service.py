from datetime import date, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import config
from app.models import AvailabilityException, BusinessHour
from app.repositories.barber_repository import BarberRepository
from app.services.date_service import TZ, label_from_minutes, range_from_minutes


class ShopStatusService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.barbers = BarberRepository(db)

    async def status(self, barber_id: UUID) -> dict:
        barber = await self.barbers.by_id(barber_id)
        if not barber:
            raise HTTPException(status_code=404, detail="Barbero no encontrado")

        now = datetime.now(TZ)
        last_day = now.date() + timedelta(days=14)
        hours_result = await self.db.execute(
            select(BusinessHour).where(BusinessHour.barber_id == barber.id)
        )
        hours = {
            item.weekday: item
            for item in hours_result.scalars().all()
        }
        exceptions_result = await self.db.execute(
            select(AvailabilityException).where(
                AvailabilityException.barber_id == barber.id,
                AvailabilityException.end_date >= now.date(),
                AvailabilityException.start_date <= last_day,
            )
        )
        exceptions = list(exceptions_result.scalars().all())

        today_hours = hours.get(now.weekday())
        today_exceptions = self._exceptions_for(exceptions, now.date())
        minute = now.hour * 60 + now.minute

        if today_hours and today_hours.is_open:
            full_day = next(
                (item for item in today_exceptions if item.all_day),
                None,
            )
            if full_day:
                next_open = self._next_open(
                    now,
                    hours,
                    exceptions,
                    start_offset=1,
                )
                return self._payload(
                    barber.id,
                    now,
                    False,
                    "unavailable",
                    full_day.title,
                    next_open,
                )

            partial = next(
                (
                    item
                    for item in today_exceptions
                    if item.start_min is not None
                    and item.end_min is not None
                    and item.start_min <= minute < item.end_min
                ),
                None,
            )
            if partial:
                change_at, _ = range_from_minutes(
                    now.date(),
                    partial.end_min,
                    1,
                )
                return self._payload(
                    barber.id,
                    now,
                    False,
                    "unavailable",
                    f"No disponible hasta {label_from_minutes(partial.end_min)}",
                    change_at,
                )

            if config.LUNCH_START <= minute < config.LUNCH_END:
                change_at, _ = range_from_minutes(
                    now.date(),
                    config.LUNCH_END,
                    1,
                )
                return self._payload(
                    barber.id,
                    now,
                    False,
                    "break",
                    f"En pausa hasta {label_from_minutes(config.LUNCH_END)}",
                    change_at,
                )

            if today_hours.open_min <= minute < today_hours.close_min:
                changes = [today_hours.close_min]
                if minute < config.LUNCH_START < today_hours.close_min:
                    changes.append(config.LUNCH_START)
                changes.extend(
                    item.start_min
                    for item in today_exceptions
                    if item.start_min is not None and item.start_min > minute
                )
                next_minute = min(changes)
                change_at, _ = range_from_minutes(
                    now.date(),
                    next_minute,
                    1,
                )
                return self._payload(
                    barber.id,
                    now,
                    True,
                    "open",
                    f"Abierto hasta {label_from_minutes(next_minute)}",
                    change_at,
                )

        next_open = self._next_open(now, hours, exceptions)
        message = (
            f"Abre {self._next_open_label(next_open, now.date())}"
            if next_open
            else "Agenda cerrada temporalmente"
        )
        return self._payload(
            barber.id,
            now,
            False,
            "closed",
            message,
            next_open,
        )

    def _next_open(
        self,
        now: datetime,
        hours: dict[int, BusinessHour],
        exceptions: list[AvailabilityException],
        start_offset: int = 0,
    ) -> datetime | None:
        current_minute = now.hour * 60 + now.minute
        for offset in range(start_offset, 15):
            day = now.date() + timedelta(days=offset)
            business = hours.get(day.weekday())
            if not business or not business.is_open:
                continue
            day_exceptions = self._exceptions_for(exceptions, day)
            if any(item.all_day for item in day_exceptions):
                continue
            candidate = business.open_min
            if offset == 0:
                candidate = max(candidate, current_minute + 1)
            for item in sorted(
                day_exceptions,
                key=lambda value: value.start_min or 0,
            ):
                if (
                    item.start_min is not None
                    and item.end_min is not None
                    and item.start_min <= candidate < item.end_min
                ):
                    candidate = item.end_min
            if config.LUNCH_START <= candidate < config.LUNCH_END:
                candidate = config.LUNCH_END
            if candidate < business.close_min:
                starts_at, _ = range_from_minutes(day, candidate, 1)
                return starts_at
        return None

    @staticmethod
    def _exceptions_for(
        exceptions: list[AvailabilityException],
        day: date,
    ) -> list[AvailabilityException]:
        return [
            item
            for item in exceptions
            if item.start_date <= day <= item.end_date
        ]

    @staticmethod
    def _next_open_label(value: datetime, today: date) -> str:
        if value.date() == today:
            return f"hoy a las {label_from_minutes(value.hour * 60 + value.minute)}"
        if value.date() == today + timedelta(days=1):
            return f"mañana a las {label_from_minutes(value.hour * 60 + value.minute)}"
        day_name = value.strftime("%A")
        names = {
            "Monday": "lunes",
            "Tuesday": "martes",
            "Wednesday": "miércoles",
            "Thursday": "jueves",
            "Friday": "viernes",
            "Saturday": "sábado",
            "Sunday": "domingo",
        }
        return (
            f"el {names.get(day_name, day_name.lower())} "
            f"a las {label_from_minutes(value.hour * 60 + value.minute)}"
        )

    @staticmethod
    def _payload(
        barber_id: UUID,
        checked_at: datetime,
        is_open: bool,
        state: str,
        message: str,
        next_change_at: datetime | None,
    ) -> dict:
        return {
            "barber_id": barber_id,
            "is_open": is_open,
            "state": state,
            "message": message,
            "next_change_at": next_change_at,
            "checked_at": checked_at,
        }
