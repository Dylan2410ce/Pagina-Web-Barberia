import re
from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models import (
    AppointmentStatus,
    AvailabilityKind,
    ReviewStatus,
    WaitlistStatus,
)


class StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("*", mode="before", check_fields=False)
    @classmethod
    def sanitize_text(cls, value):
        if not isinstance(value, str):
            return value
        cleaned = "".join(
            character
            for character in value
            if character in {"\n", "\t"} or ord(character) >= 32
        ).strip()
        if "<" in cleaned or ">" in cleaned:
            raise ValueError("El texto contiene caracteres no permitidos")
        return cleaned


class BarberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    role: str
    phone: str
    instagram_url: str | None = None
    calendar_sync: bool = False


class ServiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    duration_min: int
    price: int
    is_addon: bool
    is_active: bool = True


class BusinessHourOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    barber_id: UUID
    weekday: int
    is_open: bool
    open_min: int
    close_min: int


class BootstrapOut(BaseModel):
    barbers: list[BarberOut]
    services: list[ServiceOut]
    addons: list[ServiceOut]
    business_hours: list[BusinessHourOut]
    reviews: list["ReviewOut"] = Field(default_factory=list)
    gallery: list["GalleryItemOut"] = Field(default_factory=list)
    location: dict


class SlotOut(BaseModel):
    start_min: int
    label: str


class AppointmentCreate(StrictInput):
    barber_id: UUID
    service_id: UUID
    addon_ids: list[UUID] = Field(default_factory=list, max_length=12)
    date: date
    start_min: int = Field(ge=0, le=1439)
    client_name: str = Field(min_length=3, max_length=80)
    client_phone: str = Field(pattern=r"^[24678][0-9]{7}$")
    client_email: str | None = Field(default=None, max_length=160)
    notes: str | None = Field(default=None, max_length=240)

    @field_validator("client_email")
    @classmethod
    def validate_email(cls, value: str | None):
        if value is None or value == "":
            return None
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("El correo no tiene un formato válido")
        return value.lower()


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    barber_id: UUID
    service_id: UUID | None = None
    client_name: str
    client_phone: str
    client_email: str | None = None
    service_name: str
    addons: list[str]
    total_price: int
    starts_at: datetime
    ends_at: datetime
    status: AppointmentStatus
    notes: str | None = None
    calendar_event_id: str | None = None


class AppointmentCreatedOut(AppointmentOut):
    access_code: str


class AppointmentLookup(StrictInput):
    phone: str = Field(pattern=r"^[24678][0-9]{7}$")


class AppointmentCancel(StrictInput):
    phone: str | None = Field(default=None, pattern=r"^[24678][0-9]{7}$")
    access_code: str | None = Field(default=None, min_length=16, max_length=40)
    reason: str | None = Field(default=None, max_length=240)

    @model_validator(mode="after")
    def validate_access(self):
        if not self.phone and not self.access_code:
            raise ValueError("Indica el código de reserva")
        return self


class AppointmentReschedule(StrictInput):
    phone: str | None = Field(default=None, pattern=r"^[24678][0-9]{7}$")
    access_code: str | None = Field(default=None, min_length=16, max_length=40)
    date: date
    start_min: int = Field(ge=0, le=1439)

    @model_validator(mode="after")
    def validate_access(self):
        if not self.phone and not self.access_code:
            raise ValueError("Indica el código de reserva")
        return self


class AdminAppointmentReschedule(StrictInput):
    date: date
    start_min: int = Field(ge=0, le=1439)


class BlockCreate(StrictInput):
    date: date
    start_min: int = Field(default=480, ge=0, le=1439)
    duration_min: int | None = Field(default=None, gt=0, le=720)
    end_min: int | None = Field(default=None, ge=1, le=1440)
    all_day: bool = False
    notes: str | None = Field(default=None, max_length=240)

    @model_validator(mode="after")
    def validate_range(self):
        if not self.all_day and self.end_min is None and self.duration_min is None:
            raise ValueError("Indica la hora final o la duración del bloqueo")
        if not self.all_day and self.end_min is not None and self.end_min <= self.start_min:
            raise ValueError("La hora final debe ser mayor a la inicial")
        return self


class QuickBlockCreate(StrictInput):
    duration_min: int = Field(default=45, ge=15, le=180)
    horizon_days: int = Field(default=14, ge=1, le=31)
    notes: str | None = Field(default="Imprevisto", max_length=240)


class AppointmentUpdate(StrictInput):
    status: AppointmentStatus | None = None
    notes: str | None = Field(default=None, max_length=240)


class PasswordResetIn(StrictInput):
    username: str = Field(min_length=3, max_length=50)
    master_code: str = Field(min_length=32, max_length=80, pattern=r"^[A-Za-z0-9]+$")
    new_password: str = Field(min_length=8, max_length=80)


class PasswordChangeIn(StrictInput):
    current_password: str = Field(min_length=8, max_length=80)
    new_password: str = Field(min_length=8, max_length=80)

    @model_validator(mode="after")
    def validate_new_password(self):
        if self.current_password == self.new_password:
            raise ValueError("La nueva contraseña debe ser diferente")
        return self


class LoginIn(StrictInput):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=80)


class TokenOut(BaseModel):
    token: str


class ServiceCreate(StrictInput):
    name: str = Field(min_length=2, max_length=120)
    duration_min: int = Field(ge=0, le=360)
    price: int = Field(ge=0, le=1_000_000)
    is_addon: bool = False
    is_active: bool = True

    @model_validator(mode="after")
    def validate_duration(self):
        if not self.is_addon and self.duration_min <= 0:
            raise ValueError("Un servicio principal necesita una duración")
        return self


class ServiceUpdate(StrictInput):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    duration_min: int | None = Field(default=None, ge=0, le=360)
    price: int | None = Field(default=None, ge=0, le=1_000_000)
    is_addon: bool | None = None
    is_active: bool | None = None


class BusinessHourUpdate(StrictInput):
    weekday: int = Field(ge=0, le=6)
    is_open: bool
    open_min: int = Field(ge=0, le=1439)
    close_min: int = Field(ge=1, le=1440)


class AvailabilityExceptionCreate(StrictInput):
    start_date: date
    end_date: date
    all_day: bool = True
    start_min: int | None = Field(default=None, ge=0, le=1439)
    end_min: int | None = Field(default=None, ge=1, le=1440)
    kind: AvailabilityKind = AvailabilityKind.custom
    title: str = Field(min_length=3, max_length=120)
    notes: str | None = Field(default=None, max_length=240)

    @model_validator(mode="after")
    def validate_period(self):
        if self.end_date < self.start_date:
            raise ValueError("La fecha final debe ser igual o posterior a la inicial")
        if (self.end_date - self.start_date).days > 366:
            raise ValueError("La ausencia no puede superar un año")
        if not self.all_day:
            if self.start_date != self.end_date:
                raise ValueError(
                    "Los rangos por horas deben pertenecer a un solo día"
                )
            if self.start_min is None or self.end_min is None:
                raise ValueError("Indica la hora inicial y final")
            if self.end_min <= self.start_min:
                raise ValueError("La hora final debe ser posterior a la inicial")
        return self


class AvailabilityExceptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    barber_id: UUID
    start_date: date
    end_date: date
    all_day: bool
    start_min: int | None
    end_min: int | None
    kind: AvailabilityKind
    title: str
    notes: str | None = None
    created_at: datetime


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    barber_id: UUID
    action: str
    entity_type: str
    entity_id: UUID | None = None
    details: dict
    created_at: datetime


class ClientHistoryItem(BaseModel):
    id: UUID
    service: str
    addons: list[str]
    status: AppointmentStatus
    starts_at: datetime
    total_price: int
    notes: str | None = None


class ClientOut(BaseModel):
    name: str
    phone: str
    email: str | None = None
    appointments: int
    completed_appointments: int
    spent: int
    last_visit: datetime | None = None
    last_service: str | None = None
    favorite_service: str | None = None
    frequency_days: int | None = None
    history: list[ClientHistoryItem]


class ReminderRunOut(BaseModel):
    enabled: bool
    processed: int
    skipped: int
    status: Literal["ok", "disabled"]


class ShopStatusOut(BaseModel):
    barber_id: UUID
    is_open: bool
    state: Literal["open", "closed", "break", "unavailable"]
    message: str
    next_change_at: datetime | None = None
    checked_at: datetime


class LoyaltyOut(BaseModel):
    completed_visits: int
    target_visits: int
    current_progress: int
    visits_remaining: int
    rewards_unlocked: int
    reward_label: str


class WaitlistCreate(StrictInput):
    barber_id: UUID
    service_id: UUID
    desired_date: date
    preferred_period: Literal["any", "morning", "afternoon"] = "any"
    client_name: str = Field(min_length=3, max_length=80)
    client_phone: str = Field(pattern=r"^[24678][0-9]{7}$")
    client_email: str | None = Field(default=None, max_length=160)
    notes: str | None = Field(default=None, max_length=240)

    @field_validator("client_email")
    @classmethod
    def validate_waitlist_email(cls, value: str | None):
        if value is None or value == "":
            return None
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("El correo no tiene un formato válido")
        return value.lower()


class WaitlistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    barber_id: UUID
    service_id: UUID
    service_name: str
    desired_date: date
    preferred_period: str
    client_name: str
    client_phone: str
    client_email: str | None = None
    notes: str | None = None
    status: WaitlistStatus
    created_at: datetime


class ReviewCreate(StrictInput):
    access_code: str = Field(min_length=16, max_length=40)
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=8, max_length=400)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    appointment_id: UUID
    barber_id: UUID
    barber_name: str | None = None
    client_name: str
    rating: int
    comment: str
    status: ReviewStatus
    created_at: datetime


class ReviewSummaryOut(BaseModel):
    average: float
    total: int
    items: list[ReviewOut]


class GalleryItemCreate(StrictInput):
    image_url: str = Field(min_length=2, max_length=600)
    title: str = Field(min_length=2, max_length=100)
    alt_text: str = Field(min_length=5, max_length=180)
    category: str = Field(min_length=2, max_length=60)
    description: str = Field(min_length=8, max_length=300)
    display_order: int = Field(default=0, ge=0, le=999)
    is_active: bool = True

    @field_validator("image_url")
    @classmethod
    def validate_gallery_url(cls, value: str):
        if value.startswith("/"):
            return value
        if not re.fullmatch(r"https://[^\s]+", value):
            raise ValueError("La imagen debe usar una URL HTTPS")
        return value


class GalleryItemUpdate(StrictInput):
    title: str | None = Field(default=None, min_length=2, max_length=100)
    alt_text: str | None = Field(default=None, min_length=5, max_length=180)
    category: str | None = Field(default=None, min_length=2, max_length=60)
    description: str | None = Field(default=None, min_length=8, max_length=300)
    display_order: int | None = Field(default=None, ge=0, le=999)
    is_active: bool | None = None


class GalleryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    barber_id: UUID
    barber_name: str | None = None
    image_url: str
    title: str
    alt_text: str
    category: str
    description: str
    display_order: int
    is_active: bool
    created_at: datetime


BootstrapOut.model_rebuild()
