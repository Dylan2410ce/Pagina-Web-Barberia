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


class NotificationStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    sent = "sent"
    failed = "failed"
    skipped = "skipped"


class NotificationKind(str, enum.Enum):
    appointment_reminder = "appointment_reminder"
    waitlist_available = "waitlist_available"
    daily_summary = "daily_summary"


class PromotionType(str, enum.Enum):
    percentage = "percentage"
    fixed = "fixed"


class Barber(Base):
    __tablename__ = "barbers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    role: Mapped[str] = mapped_column(String(80), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    credentials_initialized: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    calendar_sync: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    calendar_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    instagram_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    cancellation_notice_hours: Mapped[int] = mapped_column(
        Integer,
        default=2,
        nullable=False,
    )
    reschedule_notice_hours: Mapped[int] = mapped_column(
        Integer,
        default=2,
        nullable=False,
    )
    appointment_buffer_min: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    daily_summary_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    parking_info: Mapped[str | None] = mapped_column(String(240), nullable=True)
    directions_hint: Mapped[str | None] = mapped_column(String(240), nullable=True)
    public_message: Mapped[str | None] = mapped_column(String(240), nullable=True)
    session_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

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
    business_breaks: Mapped[list["BusinessBreak"]] = relationship(
        back_populates="barber",
        cascade="all, delete-orphan",
    )
    client_profiles: Mapped[list["ClientProfile"]] = relationship(
        back_populates="barber",
        cascade="all, delete-orphan",
    )
    promotions: Mapped[list["Promotion"]] = relationship(
        back_populates="barber",
        cascade="all, delete-orphan",
    )
    expenses: Mapped[list["Expense"]] = relationship(
        back_populates="barber",
        cascade="all, delete-orphan",
    )
    cash_closes: Mapped[list["CashClose"]] = relationship(
        back_populates="barber",
        cascade="all, delete-orphan",
    )
    notifications: Mapped[list["NotificationDelivery"]] = relationship(
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
    request_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        unique=True,
        index=True,
    )
    request_fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True)
    access_code_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    reminder_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    discount_amount: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    promotion_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    last_notification_error: Mapped[str | None] = mapped_column(Text, nullable=True)

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


class BusinessBreak(Base):
    __tablename__ = "business_breaks"
    __table_args__ = (
        Index(
            "ix_business_break_barber_weekday",
            "barber_id",
            "weekday",
            "is_active",
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
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)
    start_min: Mapped[int] = mapped_column(Integer, nullable=False)
    end_min: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(80), default="Descanso", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    barber: Mapped[Barber] = relationship(back_populates="business_breaks")


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
    notified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    notification_attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
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


class ClientProfile(Base):
    __tablename__ = "client_profiles"
    __table_args__ = (
        UniqueConstraint(
            "barber_id",
            "phone",
            name="uq_client_profile_barber_phone",
        ),
        Index("ix_client_profile_barber_name", "barber_id", "name"),
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
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSON_TYPE, default=list, nullable=False)
    preferences: Mapped[str | None] = mapped_column(Text, nullable=True)
    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    anonymized_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    barber: Mapped[Barber] = relationship(back_populates="client_profiles")


class AppointmentFeedback(Base):
    __tablename__ = "appointment_feedback"

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
    satisfaction: Mapped[int] = mapped_column(Integer, nullable=False)
    booking_ease: Mapped[int] = mapped_column(Integer, nullable=False)
    would_return: Mapped[bool] = mapped_column(Boolean, nullable=False)
    private_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class Promotion(Base):
    __tablename__ = "promotions"
    __table_args__ = (
        Index(
            "ix_promotion_barber_dates",
            "barber_id",
            "start_date",
            "end_date",
            "is_active",
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
    service_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("services.id"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    discount_type: Mapped[PromotionType] = mapped_column(
        Enum(
            PromotionType,
            name="promotiontype",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        nullable=False,
    )
    discount_value: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    barber: Mapped[Barber] = relationship(back_populates="promotions")


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (
        Index("ix_expense_barber_date", "barber_id", "expense_date"),
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
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    barber: Mapped[Barber] = relationship(back_populates="expenses")


class CashClose(Base):
    __tablename__ = "cash_closes"
    __table_args__ = (
        UniqueConstraint(
            "barber_id",
            "business_date",
            name="uq_cash_close_barber_date",
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
    business_date: Mapped[date] = mapped_column(Date, nullable=False)
    gross_income: Mapped[int] = mapped_column(Integer, nullable=False)
    expenses_total: Mapped[int] = mapped_column(Integer, nullable=False)
    net_income: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    closed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    barber: Mapped[Barber] = relationship(back_populates="cash_closes")


class NotificationDelivery(Base):
    __tablename__ = "notification_deliveries"
    __table_args__ = (
        Index(
            "ix_notification_due",
            "status",
            "scheduled_for",
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
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("appointments.id"),
        nullable=True,
    )
    waitlist_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("waitlist_entries.id"),
        nullable=True,
    )
    kind: Mapped[NotificationKind] = mapped_column(
        Enum(
            NotificationKind,
            name="notificationkind",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        nullable=False,
    )
    status: Mapped[NotificationStatus] = mapped_column(
        Enum(
            NotificationStatus,
            name="notificationstatus",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        default=NotificationStatus.pending,
        nullable=False,
    )
    dedupe_key: Mapped[str] = mapped_column(
        String(180),
        nullable=False,
        unique=True,
    )
    recipient_email: Mapped[str] = mapped_column(String(160), nullable=False)
    template_id: Mapped[str] = mapped_column(String(120), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON_TYPE, default=dict, nullable=False)
    scheduled_for: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    barber: Mapped[Barber] = relationship(back_populates="notifications")
