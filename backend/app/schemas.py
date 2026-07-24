import re
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class BarberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    role: str
    phone: str


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

    weekday: int
    is_open: bool
    open_min: int
    close_min: int


class BootstrapOut(BaseModel):
    barbers: list[BarberOut]
    services: list[ServiceOut]
    addons: list[ServiceOut]
    business_hours: list[BusinessHourOut]
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
            raise ValueError("El correo no tiene un formato valido")
        return value.lower()


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    barber_id: UUID
    client_name: str
    client_phone: str
    client_email: str | None = None
    service_name: str
    addons: list[str]
    total_price: int
    starts_at: datetime
    ends_at: datetime
    status: str
    notes: str | None = None
    calendar_event_id: str | None = None


class AppointmentLookup(StrictInput):
    phone: str = Field(pattern=r"^[24678][0-9]{7}$")


class AppointmentCancel(StrictInput):
    phone: str = Field(pattern=r"^[24678][0-9]{7}$")
    reason: str | None = Field(default=None, max_length=240)


class AppointmentReschedule(StrictInput):
    phone: str = Field(pattern=r"^[24678][0-9]{7}$")
    date: date
    start_min: int = Field(ge=0, le=1439)


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
            raise ValueError("Indica la hora final o la duracion del bloqueo")
        if not self.all_day and self.end_min is not None and self.end_min <= self.start_min:
            raise ValueError("La hora final debe ser mayor a la inicial")
        return self


class AppointmentUpdate(StrictInput):
    status: str | None = None
    notes: str | None = Field(default=None, max_length=240)


class PasswordResetIn(StrictInput):
    username: str = Field(min_length=3, max_length=50)
    master_code: str = Field(min_length=32, max_length=80, pattern=r"^[A-Za-z0-9]+$")
    new_password: str = Field(min_length=8, max_length=80)


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
            raise ValueError("Un servicio principal necesita una duracion")
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
