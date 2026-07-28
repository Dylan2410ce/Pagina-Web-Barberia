from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import config
from app.models import (
    Appointment,
    AppointmentFeedback,
    AppointmentStatus,
    Barber,
    ClientProfile,
    Review,
    ReviewStatus,
    WaitlistEntry,
    WaitlistStatus,
)
from app.repositories.barber_repository import BarberRepository
from app.repositories.service_repository import ServiceRepository
from app.schemas import FeedbackCreate, ReviewCreate, WaitlistCreate
from app.services.appointment_service import AppointmentService
from app.services.date_service import TZ


def public_client_name(value: str) -> str:
    parts = value.strip().split()
    if not parts:
        return "Cliente"
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0]}."


class EngagementService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.appointments = AppointmentService(db)
        self.barbers = BarberRepository(db)
        self.services = ServiceRepository(db)

    async def join_waitlist(self, data: WaitlistCreate) -> WaitlistEntry:
        if data.desired_date < datetime.now(TZ).date():
            raise HTTPException(
                status_code=400,
                detail="Selecciona una fecha de hoy en adelante",
            )
        barber = await self.barbers.by_id(data.barber_id)
        service = await self.services.by_id(data.service_id)
        if not barber:
            raise HTTPException(status_code=404, detail="Barbero no encontrado")
        if not service or service.is_addon:
            raise HTTPException(status_code=400, detail="Servicio inválido")

        duplicate_result = await self.db.execute(
            select(WaitlistEntry.id).where(
                WaitlistEntry.barber_id == barber.id,
                WaitlistEntry.service_id == service.id,
                WaitlistEntry.desired_date == data.desired_date,
                WaitlistEntry.client_phone == data.client_phone,
                WaitlistEntry.status.in_(
                    [
                        WaitlistStatus.waiting,
                        WaitlistStatus.contacted,
                    ]
                ),
            )
        )
        if duplicate_result.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail="Ya estás en la lista de espera para ese día",
            )

        entry = WaitlistEntry(
            barber_id=barber.id,
            service_id=service.id,
            service_name=service.name,
            desired_date=data.desired_date,
            preferred_period=data.preferred_period,
            client_name=data.client_name,
            client_phone=data.client_phone,
            client_email=data.client_email,
            notes=data.notes,
            status=WaitlistStatus.waiting,
        )
        self.db.add(entry)
        await self.db.commit()
        await self.db.refresh(entry)
        return entry

    async def public_reviews(self, limit: int = 12) -> dict:
        result = await self.db.execute(
            select(Review, Barber.name)
            .join(Barber, Barber.id == Review.barber_id)
            .where(Review.status == ReviewStatus.approved)
            .order_by(Review.created_at.desc())
            .limit(limit)
        )
        rows = result.all()
        average_result = await self.db.execute(
            select(
                func.coalesce(func.avg(Review.rating), 0),
                func.count(Review.id),
            ).where(Review.status == ReviewStatus.approved)
        )
        average, total = average_result.one()
        return {
            "average": round(float(average), 1),
            "total": int(total),
            "items": [
                {
                    "id": review.id,
                    "appointment_id": review.appointment_id,
                    "barber_id": review.barber_id,
                    "barber_name": barber_name,
                    "client_name": public_client_name(review.client_name),
                    "rating": review.rating,
                    "comment": review.comment,
                    "status": review.status,
                    "created_at": review.created_at,
                }
                for review, barber_name in rows
            ],
        }

    async def create_review(self, data: ReviewCreate) -> Review:
        appointment = await self.appointments.get_by_access_code(data.access_code)
        if appointment.status != AppointmentStatus.completed:
            raise HTTPException(
                status_code=409,
                detail="La reseña estará disponible cuando la cita esté completada",
            )
        existing_result = await self.db.execute(
            select(Review.id).where(Review.appointment_id == appointment.id)
        )
        if existing_result.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail="Esta cita ya tiene una reseña",
            )

        review = Review(
            appointment_id=appointment.id,
            barber_id=appointment.barber_id,
            client_name=appointment.client_name,
            rating=data.rating,
            comment=data.comment,
            status=ReviewStatus.pending,
        )
        self.db.add(review)
        await self.db.commit()
        await self.db.refresh(review)
        return review

    async def loyalty(self, access_code: str) -> dict:
        appointment = await self.appointments.get_by_access_code(access_code)
        result = await self.db.execute(
            select(func.count(Appointment.id)).where(
                Appointment.barber_id == appointment.barber_id,
                Appointment.client_phone == appointment.client_phone,
                Appointment.status == AppointmentStatus.completed,
            )
        )
        completed = int(result.scalar_one())
        profile_result = await self.db.execute(
            select(ClientProfile).where(
                ClientProfile.barber_id == appointment.barber_id,
                ClientProfile.phone == appointment.client_phone,
            )
        )
        profile = profile_result.scalar_one_or_none()
        redeemed = profile.loyalty_redeemed if profile else 0
        target = config.LOYALTY_VISITS_TARGET
        progress = completed % target
        unlocked = completed // target
        return {
            "completed_visits": completed,
            "target_visits": target,
            "current_progress": progress,
            "visits_remaining": target - progress,
            "rewards_unlocked": unlocked,
            "rewards_redeemed": redeemed,
            "rewards_available": max(unlocked - redeemed, 0),
            "reward_label": config.LOYALTY_REWARD_LABEL,
        }

    async def create_feedback(self, data: FeedbackCreate) -> AppointmentFeedback:
        appointment = await self.appointments.get_by_access_code(data.access_code)
        if appointment.status != AppointmentStatus.completed:
            raise HTTPException(
                status_code=409,
                detail="La encuesta estará disponible cuando termine la cita",
            )
        existing_result = await self.db.execute(
            select(AppointmentFeedback.id).where(
                AppointmentFeedback.appointment_id == appointment.id
            )
        )
        if existing_result.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail="Esta cita ya tiene una encuesta registrada",
            )
        feedback = AppointmentFeedback(
            appointment_id=appointment.id,
            barber_id=appointment.barber_id,
            satisfaction=data.satisfaction,
            booking_ease=data.booking_ease,
            would_return=data.would_return,
            private_comment=data.private_comment,
        )
        self.db.add(feedback)
        await self.db.commit()
        await self.db.refresh(feedback)
        return feedback
