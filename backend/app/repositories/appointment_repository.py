from datetime import datetime

from sqlalchemy.orm import Session

from app.models import Appointment, AppointmentStatus


ACTIVE = [AppointmentStatus.booked, AppointmentStatus.blocked, AppointmentStatus.present]


class AppointmentRepository:
    def __init__(self, db: Session):
        self.db = db

    def by_id(self, appointment_id):
        return self.db.query(Appointment).filter(Appointment.id == appointment_id).first()

    def list_by_barber(self, barber_id, start: datetime | None = None, end: datetime | None = None):
        query = self.db.query(Appointment).filter(Appointment.barber_id == barber_id)
        if start and end:
            query = query.filter(Appointment.starts_at < end, Appointment.ends_at > start)
        return query.order_by(Appointment.starts_at.asc()).all()

    def list_by_phone(self, phone: str):
        return (
            self.db.query(Appointment)
            .filter(Appointment.client_phone == phone)
            .order_by(Appointment.starts_at.desc())
            .all()
        )

    def has_overlap(self, barber_id, start: datetime, end: datetime, exclude_id=None) -> bool:
        query = self.db.query(Appointment).filter(
            Appointment.barber_id == barber_id,
            Appointment.status.in_(ACTIVE),
            Appointment.starts_at < end,
            Appointment.ends_at > start,
        )
        if exclude_id:
            query = query.filter(Appointment.id != exclude_id)
        return query.first() is not None

    def save(self, appointment: Appointment):
        self.db.add(appointment)
        return appointment
