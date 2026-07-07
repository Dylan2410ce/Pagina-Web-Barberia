from datetime import date, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import config
from app.models import Appointment, AppointmentStatus
from app.repositories.appointment_repository import ACTIVE, AppointmentRepository
from app.repositories.barber_repository import BarberRepository
from app.repositories.service_repository import ServiceRepository
from app.schemas import AppointmentCreate, BlockCreate
from app.services.date_service import day_range, label_from_minutes, range_from_minutes


class AppointmentService:
    def __init__(self, db: Session):
        self.db = db
        self.appointments = AppointmentRepository(db)
        self.barbers = BarberRepository(db)
        self.services = ServiceRepository(db)

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

        if day.weekday() in (6, 0):
            return []

        day_start, day_end = day_range(day)
        busy = self.appointments.list_by_barber(barber_id, day_start, day_end)
        slots = []

        for start_min in range(config.OPEN_MIN, config.CLOSE_MIN, config.SLOT_STEP):
            end_min = start_min + duration
            if day == now.date() and start_min < (now.hour * 60 + now.minute + 30):
                continue
            if end_min > config.CLOSE_MIN:
                continue
            if start_min < config.LUNCH_START < end_min or config.LUNCH_START <= start_min < config.LUNCH_END:
                continue

            starts_at, ends_at = range_from_minutes(day, start_min, duration)
            overlap = any(
                row.status in ACTIVE and starts_at < row.ends_at and ends_at > row.starts_at
                for row in busy
            )
            if not overlap:
                slots.append({"start_min": start_min, "label": label_from_minutes(start_min)})

        return slots

    def validate_booking_window(self, day: date, start_min: int, duration: int) -> None:
        now = datetime.now(ZoneInfo("America/Costa_Rica"))
        end_min = start_min + duration

        if day < now.date():
            raise HTTPException(status_code=400, detail="No se pueden reservar fechas pasadas")
        if day.weekday() in (6, 0):
            raise HTTPException(status_code=400, detail="Domingo y lunes permanecemos cerrados")
        if start_min < config.OPEN_MIN or end_min > config.CLOSE_MIN:
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
        starts_at, ends_at = range_from_minutes(data.date, data.start_min, duration)
        lock_key = f"{data.barber_id}:{starts_at.isoformat()}"

        try:
            self.db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"), {"key": lock_key})
            if self.appointments.has_overlap(data.barber_id, starts_at, ends_at):
                self.db.rollback()
                raise HTTPException(status_code=409, detail="Ese horario ya fue tomado")

            appointment = Appointment(
                barber_id=data.barber_id,
                client_name=data.client_name,
                client_phone=data.client_phone,
                service_name=service_name,
                addons=addons,
                total_price=total,
                starts_at=starts_at,
                ends_at=ends_at,
                notes=data.notes,
            )
            self.appointments.save(appointment)
            self.db.commit()
            self.db.refresh(appointment)
            return appointment
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=409, detail="Ese horario ya fue tomado") from exc

    def create_block(self, barber_id: UUID, data: BlockCreate) -> Appointment:
        starts_at, ends_at = range_from_minutes(data.date, data.start_min, data.duration_min)
        block = Appointment(
            barber_id=barber_id,
            client_name="Bloqueo manual",
            client_phone="00000000",
            service_name="Bloqueo",
            addons=[],
            total_price=0,
            starts_at=starts_at,
            ends_at=ends_at,
            status=AppointmentStatus.blocked,
            notes=data.notes,
        )
        try:
            self.appointments.save(block)
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
        self.db.commit()
        self.db.refresh(appointment)
        return appointment
