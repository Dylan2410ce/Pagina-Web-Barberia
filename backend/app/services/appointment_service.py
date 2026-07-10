from datetime import date, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import config
from app.models import Appointment, AppointmentStatus, BusinessHour
from app.repositories.appointment_repository import ACTIVE, AppointmentRepository
from app.repositories.barber_repository import BarberRepository
from app.repositories.service_repository import ServiceRepository
from app.schemas import AppointmentCreate, BlockCreate
from app.services.calendar_service import CalendarService, parse_calendar_datetime
from app.services.date_service import day_range, label_from_minutes, range_from_minutes
from app.services.email_service import EmailService


class AppointmentService:
    def __init__(self, db: Session):
        self.db = db
        self.appointments = AppointmentRepository(db)
        self.barbers = BarberRepository(db)
        self.services = ServiceRepository(db)
        self.calendar = CalendarService()
        self.email = EmailService()

    def business_hours_for(self, day: date) -> BusinessHour | None:
        weekday = day.weekday()
        return self.db.query(BusinessHour).filter(BusinessHour.weekday == weekday).first()

    def get_duration_and_price(self, service_id: UUID, addon_ids: list[UUID]) -> tuple[str, list[str], int, int]:
        service = self.services.by_id(service_id)
        if not service or service.is_addon:
            raise HTTPException(status_code=400, detail="Servicio invalido")

        addons = [a for a in self.services.by_ids(addon_ids) if a.is_addon]
        duration = service.duration_min + sum(a.duration_min for a in addons)
        total = service.price + sum(a.price for a in addons)
        return service.name, [a.name for a in addons], duration, total

    def availability(self, barber_id: UUID, day: date, duration: int) -> list[dict]:
        now = datetime.now(ZoneInfo("America/Costa_Rica"))
        if day < now.date():
            return []

        business_hours = self.business_hours_for(day)
        if not business_hours or not business_hours.is_open:
            return []

        day_start, day_end = day_range(day)
        busy = self.appointments.list_by_barber(barber_id, day_start, day_end)
        calendar_busy = self.calendar.list_busy(day_start, day_end)
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

    def validate_booking_window(self, day: date, start_min: int, duration: int) -> None:
        now = datetime.now(ZoneInfo("America/Costa_Rica"))
        business_hours = self.business_hours_for(day)
        blocked_duration = duration + config.APPOINTMENT_BUFFER_MIN
        end_min = start_min + blocked_duration

        if day < now.date():
            raise HTTPException(status_code=400, detail="No se pueden reservar fechas pasadas")
        if not business_hours or not business_hours.is_open:
            raise HTTPException(status_code=400, detail="Ese dia esta cerrado")
        if start_min < business_hours.open_min or end_min > business_hours.close_min:
            raise HTTPException(status_code=400, detail="La hora esta fuera del horario de atencion")
        if start_min < config.LUNCH_START < end_min or config.LUNCH_START <= start_min < config.LUNCH_END:
            raise HTTPException(status_code=400, detail="Ese espacio cruza la hora de almuerzo")
        if day == now.date() and start_min < (now.hour * 60 + now.minute + 30):
            raise HTTPException(status_code=400, detail="Selecciona una hora con al menos 30 minutos de anticipacion")

    def create(self, data: AppointmentCreate) -> Appointment:
        barber = self.barbers.by_id(data.barber_id)
        if not barber:
            raise HTTPException(status_code=404, detail="Barbero no encontrado")

        service_name, addons, duration, total = self.get_duration_and_price(data.service_id, data.addon_ids)
        self.validate_booking_window(data.date, data.start_min, duration)
        blocked_duration = duration + config.APPOINTMENT_BUFFER_MIN
        starts_at, ends_at = range_from_minutes(data.date, data.start_min, blocked_duration)
        lock_key = f"{data.barber_id}:{starts_at.isoformat()}"

        try:
            self.db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"), {"key": lock_key})
            if self.appointments.has_overlap(data.barber_id, starts_at, ends_at):
                self.db.rollback()
                raise HTTPException(status_code=409, detail="Ese horario ya fue tomado")
            if self.calendar.has_overlap(starts_at, ends_at):
                self.db.rollback()
                raise HTTPException(status_code=409, detail="Ese horario esta ocupado en Google Calendar")

            appointment = Appointment(
                barber_id=data.barber_id,
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
            self.db.flush()
            appointment.calendar_event_id = self.calendar.create_event(appointment)
            self.db.commit()
            self.db.refresh(appointment)
            self.email.appointment_created(appointment)
            return appointment
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=409, detail="Ese horario ya fue tomado") from exc

    def create_block(self, barber_id: UUID, data: BlockCreate) -> Appointment:
        now = datetime.now(ZoneInfo("America/Costa_Rica"))
        if data.date < now.date():
            raise HTTPException(status_code=400, detail="No se pueden bloquear fechas pasadas")

        if data.all_day:
            start_min = config.OPEN_MIN
            duration = config.CLOSE_MIN - config.OPEN_MIN
            client_name = "Dia bloqueado"
            service_name = "Bloqueo de dia"
        else:
            start_min = data.start_min
            duration = data.end_min - data.start_min if data.end_min is not None else data.duration_min
            client_name = "Bloqueo manual"
            service_name = "Bloqueo"

        if duration is None or duration <= 0:
            raise HTTPException(status_code=400, detail="El bloqueo necesita una hora final mayor a la inicial")
        if start_min < config.OPEN_MIN or start_min + duration > config.CLOSE_MIN:
            raise HTTPException(status_code=400, detail="El bloqueo debe estar dentro del horario de atencion")

        starts_at, ends_at = range_from_minutes(data.date, start_min, duration)
        block = Appointment(
            barber_id=barber_id,
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
        try:
            if self.appointments.has_overlap(barber_id, starts_at, ends_at):
                raise HTTPException(status_code=409, detail="El bloqueo choca con una cita existente")
            if self.calendar.has_overlap(starts_at, ends_at):
                raise HTTPException(status_code=409, detail="Ese espacio esta ocupado en Google Calendar")

            self.appointments.save(block)
            self.db.flush()
            block.calendar_event_id = self.calendar.create_event(block)
            self.db.commit()
            self.db.refresh(block)
            return block
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=409, detail="El bloqueo choca con una cita existente") from exc

    def update_status(self, appointment_id: UUID, barber_id: UUID, status: str) -> Appointment:
        appointment = self.appointments.by_id(appointment_id)
        if not appointment or appointment.barber_id != barber_id:
            raise HTTPException(status_code=404, detail="Cita no encontrada")

        appointment.status = AppointmentStatus(status)
        if appointment.status == AppointmentStatus.cancelled:
            self.calendar.delete_event(appointment.calendar_event_id)
            appointment.calendar_event_id = None
            self.email.appointment_cancelled(appointment)
        self.db.commit()
        self.db.refresh(appointment)
        return appointment

    def list_by_phone(self, phone: str) -> list[Appointment]:
        return [
            item for item in self.appointments.list_by_phone(phone)
            if item.status in [AppointmentStatus.booked, AppointmentStatus.present]
        ]

    def cancel_by_client(self, appointment_id: UUID, phone: str, reason: str | None = None) -> Appointment:
        appointment = self.appointments.by_id(appointment_id)
        if not appointment or appointment.client_phone != phone:
            raise HTTPException(status_code=404, detail="Cita no encontrada para ese telefono")
        if appointment.status != AppointmentStatus.booked:
            raise HTTPException(status_code=400, detail="Solo se pueden cancelar citas reservadas")

        appointment.status = AppointmentStatus.cancelled
        appointment.notes = f"{appointment.notes or ''}\nCancelada por cliente: {reason or ''}".strip()
        self.calendar.delete_event(appointment.calendar_event_id)
        appointment.calendar_event_id = None
        self.db.commit()
        self.db.refresh(appointment)
        self.email.appointment_cancelled(appointment)
        return appointment

    def _reschedule(self, appointment: Appointment, day: date, start_min: int) -> Appointment:
        duration = int((appointment.ends_at - appointment.starts_at).total_seconds() // 60)
        self.validate_booking_window(day, start_min, max(duration - config.APPOINTMENT_BUFFER_MIN, 0))
        starts_at, ends_at = range_from_minutes(day, start_min, duration)

        old_start = appointment.starts_at.isoformat()

        try:
            if self.appointments.has_overlap(appointment.barber_id, starts_at, ends_at, exclude_id=appointment.id):
                raise HTTPException(status_code=409, detail="Ese horario ya fue tomado")
            if self.calendar.has_overlap(starts_at, ends_at, ignore_event_id=appointment.calendar_event_id):
                raise HTTPException(status_code=409, detail="Ese horario esta ocupado en Google Calendar")

            old_event_id = appointment.calendar_event_id
            appointment.starts_at = starts_at
            appointment.ends_at = ends_at
            appointment.notes = f"{appointment.notes or ''}\nReprogramada desde {old_start}".strip()
            appointment.calendar_event_id = None
            self.db.flush()
            self.calendar.delete_event(old_event_id)
            appointment.calendar_event_id = self.calendar.create_event(appointment)
            self.db.commit()
            self.db.refresh(appointment)
            self.email.appointment_rescheduled(appointment)
            return appointment
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=409, detail="Ese horario ya fue tomado") from exc

    def reschedule_by_client(self, appointment_id: UUID, phone: str, day: date, start_min: int) -> Appointment:
        appointment = self.appointments.by_id(appointment_id)
        if not appointment or appointment.client_phone != phone:
            raise HTTPException(status_code=404, detail="Cita no encontrada para ese telefono")
        if appointment.status != AppointmentStatus.booked:
            raise HTTPException(status_code=400, detail="Solo se pueden reprogramar citas reservadas")
        return self._reschedule(appointment, day, start_min)

    def reschedule_by_admin(self, appointment_id: UUID, barber_id: UUID, day: date, start_min: int) -> Appointment:
        appointment = self.appointments.by_id(appointment_id)
        if not appointment or appointment.barber_id != barber_id:
            raise HTTPException(status_code=404, detail="Cita no encontrada")
        if appointment.status not in [AppointmentStatus.booked, AppointmentStatus.blocked]:
            raise HTTPException(status_code=400, detail="Solo se pueden mover citas activas o bloqueos")
        return self._reschedule(appointment, day, start_min)
