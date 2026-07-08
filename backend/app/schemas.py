from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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


class BootstrapOut(BaseModel):
    barbers: list[BarberOut]
    services: list[ServiceOut]
    addons: list[ServiceOut]
    location: dict


class AppointmentCreate(BaseModel):
    barber_id: UUID
    service_id: UUID
    addon_ids: list[UUID] = []
    date: date
    start_min: int
    client_name: str = Field(min_length=3, max_length=80)
    client_phone: str = Field(pattern=r"^[24678][0-9]{7}$")
    notes: str | None = None


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    barber_id: UUID
    client_name: str
    client_phone: str
    service_name: str
    addons: list[str]
    total_price: int
    starts_at: datetime
    ends_at: datetime
    status: str
    notes: str | None = None


class BlockCreate(BaseModel):
    date: date
    start_min: int = 480
    duration_min: int | None = Field(default=None, gt=0, le=720)
    end_min: int | None = None
    all_day: bool = False
    notes: str | None = None


class AppointmentUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None


class PasswordResetIn(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    master_code: str = Field(min_length=32, max_length=80, pattern=r"^[A-Za-z0-9]+$")
    new_password: str = Field(min_length=8, max_length=80)


class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    token: str
