import re
from urllib.parse import urlsplit

from pydantic import ConfigDict, Field, field_validator, model_validator

from app.schemas import BarberOut, StrictInput, validate_strong_password


class PerfilEquipo(StrictInput):
    name: str = Field(min_length=2, max_length=80)
    role: str = Field(default="Barbero", min_length=2, max_length=80)
    phone: str = Field(pattern=r"^[24678][0-9]{7}$")
    email: str | None = Field(default=None, max_length=160)
    instagram_url: str | None = Field(default=None, max_length=255)
    photo_url: str | None = Field(default=None, max_length=500)
    public_message: str | None = Field(default=None, max_length=240)
    calendar_sync: bool = False
    calendar_id: str | None = Field(default=None, max_length=255)

    @field_validator("email", "instagram_url", "photo_url", "public_message", "calendar_id", mode="before")
    @classmethod
    def vacio_a_nulo(cls, valor):
        return None if isinstance(valor, str) and not valor.strip() else valor

    @field_validator("email")
    @classmethod
    def correo_valido(cls, valor):
        if valor and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", valor):
            raise ValueError("Revisa el correo electrónico")
        return valor.lower() if valor else None

    @field_validator("instagram_url")
    @classmethod
    def instagram_valido(cls, valor):
        if valor:
            partes = urlsplit(valor)
            if partes.scheme != "https" or partes.netloc not in {"instagram.com", "www.instagram.com"}:
                raise ValueError("Usa un enlace HTTPS de Instagram")
        return valor

    @field_validator("photo_url")
    @classmethod
    def foto_valida(cls, valor):
        if not valor:
            return valor
        local = valor.startswith("/assets/") and not any(item in valor for item in ("..", "\\", "?", "#", "%"))
        partes = urlsplit(valor)
        remoto = partes.scheme == "https" and partes.netloc == "res.cloudinary.com"
        if not local and not remoto:
            raise ValueError("Usa una foto en /assets/ o una URL HTTPS de Cloudinary")
        return valor

    @model_validator(mode="after")
    def calendario_valido(self):
        if self.calendar_sync and (
            not self.calendar_id or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", self.calendar_id)
        ):
            raise ValueError("Añade el ID del calendario que compartiste con la cuenta de servicio")
        if not self.calendar_sync:
            self.calendar_id = None
        return self


class CrearBarbero(PerfilEquipo):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-z][a-z0-9_]{2,49}$")
    password: str = Field(min_length=12, max_length=72)

    @field_validator("password")
    @classmethod
    def clave_segura(cls, valor):
        if len(valor.encode("utf-8")) > 72:
            raise ValueError("La contraseña supera el límite de 72 bytes")
        return validate_strong_password(valor)


class EditarBarbero(PerfilEquipo):
    pass


class EquipoOut(BarberOut):
    model_config = ConfigDict(from_attributes=True)
    username: str
    calendar_id: str | None = None
    is_active: bool
