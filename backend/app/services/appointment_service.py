import asyncio
from datetime import date, datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import config
from app.models import Appointment, AppointmentStatus, Barber, BusinessHour
from app.repositories.appointment_repository import ACTIVE, AppointmentRepository
from app.repositories.barber_repository import BarberRepository
from app.repositories.service_repository import ServiceRepository
from app.schemas import AppointmentCreate, BlockCreate
from app.services.calendar_service import CalendarError, CalendarService, parse_calendar_datetime
from app.services.date_service import TZ, day_range, label_from_minutes, range_from_minutes
from app.services.email_service import EmailService


class AppointmentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.appointments = AppointmentRepository(db)
        self.barbers = BarberRepository(db)
        self.services = ServiceRepository(db)
        self.calendar = CalendarService()
        self.email = EmailService()

    async def business_hours_for(self, barber_id: UUID, day: date) -> BusinessHour | None:
        result = await self.db.execute(
            select(BusinessHour).where(
                BusinessHour.barber_id == barber_id,
                BusinessHour.weekday == day.weekday(),
            )
        )
        return result.scalar_one_or_none()

    async def lock_schedule(self, barber_id: UUID, day: date) -> None:
        if self.db.bind and self.db.bind.dialect.name != "postgresql":
            return
        lock_key = f"schedule:{barber_id}:{day.isoformat()}"
        await self.db.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
            {"key": lock_key},
        )

    async def get_duration_and_price(
        self,
        service_id: UUID,
        addon_ids: list[UUID],
    ) -> tuple[str, list[str], int, int]:
        service = await self.services.by_id(service_id)
        if not service or service.is_addon:
            raise HTTPException(status_code=400, detail="Servicio invalido")

        addons = [item for item in await self.services.by_ids(addon_ids) if item.is_addon]
        duration = service.duration_min
        total = service.price + sum(item.price for item in addons)
        return service.name, [item.name for item in addons], duration, total

    async def _calendar_busy(
        self,
        barber: Barber,
        start: datetime,
        end: datetime,
    ) -> list[dict]:
        if not barber.calendar_sync:
            return []
        available = await asyncio.to_thread(self.calendar.is_available)
        if config.CALENDAR_REQUIRED and not available:
            raise HTTPException(
                status_code=503,
                detail="La agenda de Sebastian esta sincronizando. Intenta de nuevo en unos segundos.",
            )
        try:
            return await asyncio.to_thread(self.calendar.list_busy, start, end)
        except CalendarError as exc:
            raise HTTPException(
                status_code=503,
                detail="No pudimos verificar la agenda de Sebastian. Intenta de nuevo.",
            ) from exc

    async def _calendar_has_overlap(
        self,
        barber: Barber,
        start: datetime,
        end: datetime,
        ignore_event_id: str | None = None,
    ) -> bool:
        if not barber.calendar_sync:
            return False
        available = await asyncio.to_thread(self.calendar.is_available)
        if config.CALENDAR_REQUIRED and not available:
            raise HTTPException(
                status_code=503,
                detail="La agenda de Sebastian esta sincronizando. Intenta de nuevo en unos segundos.",
            )
        try:
            return await asyncio.to_thread(
                self.calendar.has_overlap,
                start,
                end,
                ignore_event_id,
            )
        except CalendarError as exc:
            raise HTTPException(
                status_code=503,
                detail="No pudimos verificar la agenda de Sebastian. Intenta de nuevo.",
            ) from exc

    async def _create_calendar_event(
        self,
        barber: Barber,
        appointment: Appointment,
    ) -> str | None:
        if not barber.calendar_sync:
            return None
        event_id = await asyncio.to_thread(self.calendar.create_event, appointment)
        if config.CALENDAR_REQUIRED and not event_id:
            raise CalendarError("Google Calendar no devolvio id de evento")
        return event_id

    async def _delete_calendar_event(self, barber: Barber, event_id: str | None) -> None:
        if barber.calendar_sync and event_id:
            await asyncio.to_thread(self.calendar.delete_event, event_id)

    async def _notify(self, method_name: str, appointment: Appointment) -> None:
        if self.email.enabled():
            await asyncio.to_thread(getattr(self.email, method_name), appointment)

    async def availability(self, barber_id: UUID, day: date, duration: int) -> list[dict]:
        now = datetime.now(TZ)
        if day < now.date():
            return []
        barber = await self.barbers.by_id(barber_id)
        if not barber:
            raise HTTPException(status_code=404, detail="Barbero no encontrado")
        if duration <= 0:
            raise HTTPException(status_code=400, detail="El servicio necesita una duracion valida")

        business_hours = await self.business_hours_for(barber.id, day)
        if not business_hours or not business_hours.is_open:
            return []

        day_start, day_end = day_range(day)
        busy = await self.appointments.list_by_barber(
            barber.id,
            day_start,
            day_end,
            active_only=True,
        )
        calendar_busy = await self._calendar_busy(barber, day_start, day_end)
        slots = []
        blocked_duration = duration + config.APPOINTMENT_BUFFER_MIN

        for start_min in range(business_hours.open_min, business_hours.close_min, config.SLOT_STEP):
            end_min = start_min + blocked_duration
            if day == now.date() and start_min < (now.hour * 60 + now.minute + 30):
                continue
            if end_min > business_hours.close_min:
                continue
            if start_min < config.LUNCH_START < end_min or config.LUNCH_START <= start_min < config.LUNCH_END:
                continue

            starts_at, ends_at = range_from_minutes(day, start_min, blocked_duration)
            db_overlap = any(
                row.status in ACTIVE and starts_at < row.ends_at and ends_at > row.starts_at
                for row in busy
            )
            calendar_overlap = any(
                starts_at < parse_calendar_datetime(item["end"])
                and ends_at > parse_calendar_datetime(item["start"])
                for item in calendar_busy
            )
            if not db_overlap and not calendar_overlap:
                slots.append({"start_min": start_min, "label": label_from_minutes(start_min)})

        return slots

    async def validate_booking_window(
        self,
        barber_id: UUID,
        day: date,
        start_min: int,
        duration: int,
    ) -> None:
        now = datetime.now(TZ)
        business_hours = await self.business_hours_for(barber_id, day)
        blocked_duration = duration + config.APPOINTMENT_BUFFER_MIN
        end_min = start_min + blocked_duration

        if duration <= 0:
            raise HTTPException(status_code=400, detail="El servicio necesita una duracion valida")
        if day < now.date():
            raise HTTPException(status_code=400, detail="No se pueden reservar fechas pasadas")
        if not business_hours or not business_hours.is_open:
            raise HTTPException(status_code=400, detail="Ese dia esta cerrado")
        if (start_min - business_hours.open_min) % config.SLOT_STEP != 0:
            raise HTTPException(status_code=400, detail="La hora no pertenece a un bloque disponible")
        if start_min < business_hours.open_min or end_min > business_hours.close_min:
            raise HTTPException(status_code=400, detail="La hora esta fuera del horario de atencion")
        if start_min < config.LUNCH_START < end_min or config.LUNCH_START <= start_min < config.LUNCH_END:
            raise HTTPException(status_code=400, detail="Ese espacio cruza la hora de almuerzo")
        if day == now.date() and start_min < (now.hour * 60 + now.minute + 30):
            raise HTTPException(
                status_code=400,
                detail="Selecciona una hora con al menos 30 minutos de anticipacion",
            )

    async def create(self, data: AppointmentCreate) -> Appointment:
        barber = await self.barbers.by_id(data.barber_id)
        if not barber:
            raise HTTPException(status_code=404, detail="Barbero no encontrado")

        service_name, addons, duration, total = await self.get_duration_and_price(
            data.service_id,
            data.addon_ids,
        )
        await self.validate_booking_window(barber.id, data.date, data.start_min, duration)
        blocked_duration = duration + config.APPOINTMENT_BUFFER_MIN
        starts_at, ends_at = range_from_minutes(data.date, data.start_min, blocked_duration)
        created_event_id = None

        try:
            await self.lock_schedule(barber.id, data.date)
            if await self.appointments.has_overlap(barber.id, starts_at, ends_at):
                await self.db.rollback()
                raise HTTPException(status_code=409, detail="Ese horario ya fue tomado")
            if await self._calendar_has_overlap(barber, starts_at, ends_at):
                await self.db.rollback()
                raise HTTPException(
                    status_code=409,
                    detail="Ese horario esta ocupado en la agenda de Sebastian",
                )

            appointment = Appointment(
                barber_id=barber.id,
                client_name=data.client_name,
                client_phone=data.client_phone,
                client_email=data.client_email,
                service_name=service_name,
                addons=addons,
                total_price=total,
                starts_at=starts_at,
                ends_at=ends_at,
                notes=data.notes,
            )
            self.appointments.save(appointment)
            await self.db.flush()
            created_event_id = await self._create_calendar_event(barber, appointment)
            appointment.calendar_event_id = created_event_id
            await self.db.commit()
            await self.db.refresh(appointment)
            await self._notify("appointment_created", appointment)
            return appointment
        except CalendarError as exc:
            await self.db.rollback()
            if created_event_id:
                await self._delete_calendar_event(barber, created_event_id)
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except IntegrityError as exc:
            await self.db.rollback()
            if created_event_id:
                await self._delete_calendar_event(barber, created_event_id)
            raise HTTPException(status_code=409, detail="Ese horario ya fue tomado") from exc

    async def create_block(self, barber_id: UUID, data: BlockCreate) -> Appointment:
        barber = await self.barbers.by_id(barber_id)
        if not barber:
            raise HTTPException(status_code=404, detail="Barbero no encontrado")

        now = datetime.now(TZ)
        if data.date < now.date():
            raise HTTPException(status_code=400, detail="No se pueden bloquear fechas pasadas")

        business_hours = await self.business_hours_for(barber.id, data.date)
        if data.all_day:
            start_min = business_hours.open_min if business_hours else config.OPEN_MIN
            close_min = business_hours.close_min if business_hours else config.CLOSE_MIN
            duration = close_min - start_min
            client_name = "Dia bloqueado"
            service_name = "Bloqueo de dia"
        else:
            start_min = data.start_min
            duration = data.end_min - data.start_min if data.end_min is not None else data.duration_min
            client_name = "Bloqueo manual"
            service_name = "Bloqueo"

        if duration is None or duration <= 0:
            raise HTTPException(
                status_code=400,
                detail="El bloqueo necesita una hora final mayor a la inicial",
            )
        open_min = business_hours.open_min if business_hours else config.OPEN_MIN
        close_min = business_hours.close_min if business_hours else config.CLOSE_MIN
        if start_min < open_min or start_min + duration > close_min:
            raise HTTPException(
                status_code=400,
                detail="El bloqueo debe estar dentro del horario de atencion",
            )

        starts_at, ends_at = range_from_minutes(data.date, start_min, duration)
        block = Appointment(
            barber_id=barber.id,
            client_name=client_name,
            client_phone="00000000",
            service_name=service_name,
            addons=[],
            total_price=0,
            starts_at=starts_at,
            ends_at=ends_at,
            status=AppointmentStatus.blocked,
            notes=data.notes,
        )
        created_event_id = None
        try:
            await self.lock_schedule(barber.id, data.date)
            if await self.appointments.has_overlap(barber.id, starts_at, ends_at):
                await self.db.rollback()
                raise HTTPException(
                    status_code=409,
                    detail="El bloqueo choca con una cita existente",
                )
            if await self._calendar_has_overlap(barber, starts_at, ends_at):
                await self.db.rollback()
                raise HTTPException(
                    status_code=409,
                    detail="Ese espacio esta ocupado en la agenda de Sebastian",
                )

            self.appointments.save(block)
            await self.db.flush()
            created_event_id = await self._create_calendar_event(barber, block)
            block.calendar_event_id = created_event_id
            await self.db.commit()
            await self.db.refresh(block)
            return block
        except CalendarError as exc:
            await self.db.rollback()
            if created_event_id:
                await self._delete_calendar_event(barber, created_event_id)
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except IntegrityError as exc:
            await self.db.rollback()
            if created_event_id:
                await self._delete_calendar_event(barber, created_event_id)
            raise HTTPException(
                status_code=409,
                detail="El bloqueo choca con una cita existente",
            ) from exc

    async def update_status(
        self,
        appointment_id: UUID,
        barber_id: UUID,
        status: str,
    ) -> Appointment:
        appointment = await self.appointments.by_id(appointment_id)
        if not appointment or appointment.barber_id != barber_id:
            raise HTTPException(status_code=404, detail="Cita no encontrada")
        barber = await self.barbers.by_id(barber_id)
        if not barber:
            raise HTTPException(status_code=404, detail="Barbero no encontrado")

        next_status = AppointmentStatus(status)
        allowed_transitions = {
            AppointmentStatus.booked: {
                AppointmentStatus.present,
                AppointmentStatus.noshow,
                AppointmentStatus.cancelled,
            },
            AppointmentStatus.blocked: {AppointmentStatus.cancelled},
        }
        if next_status not in allowed_transitions.get(appointment.status, set()):
            raise HTTPException(
                status_code=400,
                detail="Ese cambio de estado no esta permitido",
            )

        appointment.status = next_status
        event_id = appointment.calendar_event_id
        if appointment.status == AppointmentStatus.cancelled:
            appointment.calendar_event_id = None
        await self.db.commit()
        await self.db.refresh(appointment)
        if appointment.status == AppointmentStatus.cancelled:
            await self._delete_calendar_event(barber, event_id)
            await self._notify("appointment_cancelled", appointment)
        return appointment

    async def list_by_phone(self, phone: str) -> list[Appointment]:
        return await self.appointments.list_by_phone(
            phone,
            statuses=[AppointmentStatus.booked, AppointmentStatus.present],
        )

    async def cancel_by_client(
        self,
        appointment_id: UUID,
        phone: str,
        reason: str | None = None,
    ) -> Appointment:
        appointment = await self.appointments.by_id(appointment_id)
        if not appointment or appointment.client_phone != phone:
            raise HTTPException(status_code=404, detail="Cita no encontrada para ese telefono")
        if appointment.status != AppointmentStatus.booked:
            raise HTTPException(
                status_code=400,
                detail="Solo se pueden cancelar citas reservadas",
            )
        barber = await self.barbers.by_id(appointment.barber_id)
        if not barber:
            raise HTTPException(status_code=404, detail="Barbero no encontrado")

        event_id = appointment.calendar_event_id
        appointment.status = AppointmentStatus.cancelled
        appointment.notes = (
            f"{appointment.notes or ''}\nCancelada por cliente: {reason or ''}".strip()
        )
        appointment.calendar_event_id = None
        await self.db.commit()
        await self.db.refresh(appointment)
        await self._delete_calendar_event(barber, event_id)
        await self._notify("appointment_cancelled", appointment)
        return appointment

    async def _reschedule(
        self,
        appointment: Appointment,
        barber: Barber,
        day: date,
        start_min: int,
    ) -> Appointment:
        duration = int((appointment.ends_at - appointment.starts_at).total_seconds() // 60)
        await self.validate_booking_window(
            barber.id,
            day,
            start_min,
            max(duration - config.APPOINTMENT_BUFFER_MIN, 0),
        )
        starts_at, ends_at = range_from_minutes(day, start_min, duration)
        old_start = appointment.starts_at.isoformat()
        old_event_id = appointment.calendar_event_id
        new_event_id = None

        try:
            await self.lock_schedule(barber.id, day)
            if await self.appointments.has_overlap(
                barber.id,
                starts_at,
                ends_at,
                exclude_id=appointment.id,
            ):
                await self.db.rollback()
                raise HTTPException(status_code=409, detail="Ese horario ya fue tomado")
            if await self._calendar_has_overlap(
                barber,
                starts_at,
                ends_at,
                ignore_event_id=old_event_id,
            ):
                await self.db.rollback()
                raise HTTPException(
                    status_code=409,
                    detail="Ese horario esta ocupado en la agenda de Sebastian",
                )

            appointment.starts_at = starts_at
            appointment.ends_at = ends_at
            appointment.notes = (
                f"{appointment.notes or ''}\nReprogramada desde {old_start}".strip()
            )
            appointment.calendar_event_id = None
            await self.db.flush()
            new_event_id = await self._create_calendar_event(barber, appointment)
            appointment.calendar_event_id = new_event_id
            await self.db.commit()
            await self.db.refresh(appointment)
            await self._delete_calendar_event(barber, old_event_id)
            await self._notify("appointment_rescheduled", appointment)
            return appointment
        except CalendarError as exc:
            await self.db.rollback()
            if new_event_id:
                await self._delete_calendar_event(barber, new_event_id)
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except IntegrityError as exc:
            await self.db.rollback()
            if new_event_id:
                await self._delete_calendar_event(barber, new_event_id)
            raise HTTPException(status_code=409, detail="Ese horario ya fue tomado") from exc

    async def reschedule_by_client(
        self,
        appointment_id: UUID,
        phone: str,
        day: date,
        start_min: int,
    ) -> Appointment:
        appointment = await self.appointments.by_id(appointment_id)
        if not appointment or appointment.client_phone != phone:
            raise HTTPException(status_code=404, detail="Cita no encontrada para ese telefono")
        if appointment.status != AppointmentStatus.booked:
            raise HTTPException(
                status_code=400,
                detail="Solo se pueden reprogramar citas reservadas",
            )
        barber = await self.barbers.by_id(appointment.barber_id)
        if not barber:
            raise HTTPException(status_code=404, detail="Barbero no encontrado")
        return await self._reschedule(appointment, barber, day, start_min)

    async def reschedule_by_admin(
        self,
        appointment_id: UUID,
        barber_id: UUID,
        day: date,
        start_min: int,
    ) -> Appointment:
        appointment = await self.appointments.by_id(appointment_id)
        if not appointment or appointment.barber_id != barber_id:
            raise HTTPException(status_code=404, detail="Cita no encontrada")
        if appointment.status not in [AppointmentStatus.booked, AppointmentStatus.blocked]:
            raise HTTPException(
                status_code=400,
                detail="Solo se pueden mover citas activas o bloqueos",
            )
        barber = await self.barbers.by_id(barber_id)
        if not barber:
            raise HTTPException(status_code=404, detail="Barbero no encontrado")
        return await self._reschedule(appointment, barber, day, start_min)
