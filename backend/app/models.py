import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

JSON_TYPE = JSON().with_variant(JSONB, "postgresql")


class AppointmentStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"
    blocked = "blocked"
    rescheduled = "rescheduled"

    booked = "pending"
    present = "completed"
    noshow = "no_show"

    @classmethod
    def _missing_(cls, value):
        legacy = {
            "booked": cls.pending,
            "present": cls.completed,
            "noshow": cls.no_show,
        }
        return legacy.get(value)


class AvailabilityKind(str, enum.Enum):
    holiday = "holiday"
    vacation = "vacation"
    personal = "personal"
    custom = "custom"


class WaitlistStatus(str, enum.Enum):
    waiting = "waiting"
    contacted = "contacted"
    booked = "booked"
    cancelled = "cancelled"


class ReviewStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class Barber(Base):
    __tablename__ = "barbers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    role: Mapped[str] = mapped_column(String(80), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    credentials_initialized: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    calendar_sync: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    calendar_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    instagram_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    appointments: Mapped[list["Appointment"]] = relationship(back_populates="barber")
    business_hours: Mapped[list["BusinessHour"]] = relationship(
        back_populates="barber",
        cascade="all, delete-orphan",
    )
    availability_exceptions: Mapped[list["AvailabilityException"]] = relationship(
        back_populates="barber",
        cascade="all, delete-orphan",
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        back_populates="barber",
        cascade="all, delete-orphan",
    )
    waitlist_entries: Mapped[list["WaitlistEntry"]] = relationship(
        back_populates="barber",
        cascade="all, delete-orphan",
    )
    reviews: Mapped[list["Review"]] = relationship(
        back_populates="barber",
        cascade="all, delete-orphan",
    )
    gallery_items: Mapped[list["GalleryItem"]] = relationship(
        back_populates="barber",
        cascade="all, delete-orphan",
    )


class Service(Base):
    __tablename__ = "services"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    duration_min: Mapped[int] = mapped_column(Integer, nullable=False)
    base_price: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    is_addon: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        Index("ix_appointments_barber_status_start", "barber_id", "status", "starts_at"),
        Index("ix_appointments_phone_start", "client_phone", "starts_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    barber_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("barbers.id"), index=True)
    service_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("services.id"),
        nullable=True,
        index=True,
    )
    client_name: Mapped[str] = mapped_column(String(100), nullable=False)
    client_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    client_email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    service_name: Mapped[str] = mapped_column(String(120), nullable=False)
    addons: Mapped[list[str]] = mapped_column(JSON_TYPE, default=list)
    total_price: Mapped[int] = mapped_column(Integer, nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    calendar_event_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    access_code_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        unique=True,
        index=True,
    )
    access_code_hint: Mapped[str | None] = mapped_column(
        String(8),
        nullable=True,
    )
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(
            AppointmentStatus,
            name="appointmentstatus",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        default=AppointmentStatus.pending,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reminder_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    barber: Mapped[Barber] = relationship(back_populates="appointments")


class BusinessHour(Base):
    __tablename__ = "business_hours"
    __table_args__ = (
        UniqueConstraint("barber_id", "weekday", name="uq_business_hours_barber_weekday"),
        Index("ix_business_hours_barber_weekday", "barber_id", "weekday"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    barber_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("barbers.id"),
        nullable=False,
    )
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    open_min: Mapped[int] = mapped_column(Integer, default=8 * 60)
    close_min: Mapped[int] = mapped_column(Integer, default=19 * 60)

    barber: Mapped[Barber] = relationship(back_populates="business_hours")


class AvailabilityException(Base):
    __tablename__ = "availability_exceptions"
    __table_args__ = (
        Index(
            "ix_availability_exceptions_barber_dates",
            "barber_id",
            "start_date",
            "end_date",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    barber_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("barbers.id"),
        nullable=False,
        index=True,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    kind: Mapped[AvailabilityKind] = mapped_column(
        Enum(
            AvailabilityKind,
            name="availabilitykind",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        default=AvailabilityKind.custom,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    barber: Mapped[Barber] = relationship(
        back_populates="availability_exceptions",
    )

    @property
    def all_day(self) -> bool:
        return self.start_min is None or self.end_min is None


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_barber_created", "barber_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    barber_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("barbers.id"),
        nullable=False,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
    details: Mapped[dict] = mapped_column(JSON_TYPE, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    barber: Mapped[Barber] = relationship(back_populates="audit_logs")


class WaitlistEntry(Base):
    __tablename__ = "waitlist_entries"
    __table_args__ = (
        Index(
            "ix_waitlist_barber_date_status",
            "barber_id",
            "desired_date",
            "status",
        ),
        Index("ix_waitlist_phone_created", "client_phone", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    barber_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("barbers.id"),
        nullable=False,
        index=True,
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("services.id"),
        nullable=False,
    )
    service_name: Mapped[str] = mapped_column(String(120), nullable=False)
    desired_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    preferred_period: Mapped[str] = mapped_column(
        String(20),
        default="any",
        nullable=False,
    )
    client_name: Mapped[str] = mapped_column(String(100), nullable=False)
    client_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    client_email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[WaitlistStatus] = mapped_column(
        Enum(
            WaitlistStatus,
            name="waitliststatus",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        default=WaitlistStatus.waiting,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    barber: Mapped[Barber] = relationship(back_populates="waitlist_entries")


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        Index("ix_reviews_barber_status_created", "barber_id", "status", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("appointments.id"),
        nullable=False,
        unique=True,
    )
    barber_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("barbers.id"),
        nullable=False,
        index=True,
    )
    client_name: Mapped[str] = mapped_column(String(100), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ReviewStatus] = mapped_column(
        Enum(
            ReviewStatus,
            name="reviewstatus",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        default=ReviewStatus.pending,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    barber: Mapped[Barber] = relationship(back_populates="reviews")


class GalleryItem(Base):
    __tablename__ = "gallery_items"
    __table_args__ = (
        Index(
            "ix_gallery_barber_active_order",
            "barber_id",
            "is_active",
            "display_order",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    barber_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("barbers.id"),
        nullable=False,
        index=True,
    )
    image_url: Mapped[str] = mapped_column(String(600), nullable=False)
    cloudinary_public_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    alt_text: Mapped[str] = mapped_column(String(180), nullable=False)
    category: Mapped[str] = mapped_column(String(60), nullable=False)
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    barber: Mapped[Barber] = relationship(back_populates="gallery_items")
