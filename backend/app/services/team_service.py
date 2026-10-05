import asyncio
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import config
from app.models import Appointment, AppointmentStatus, Barber, BusinessBreak, BusinessHour
from app.repositories.barber_repository import BarberRepository
from app.schemas_team import CrearBarbero, EditarBarbero
from app.services.audit_service import AuditService
from app.services.password_service import hash_password


def exigir_propietario(barbero: Barber) -> Barber:
    if barbero.username != "sebas":
        raise HTTPException(status_code=403, detail="Solo el propietario puede gestionar el equipo")
    return barbero


class EquipoService:
    def __init__(self, db: AsyncSession, propietario: Barber):
        self.db = db
        self.propietario = exigir_propietario(propietario)
        self.repositorio = BarberRepository(db)

    async def listar(self) -> list[Barber]:
        return await self.repositorio.all_profiles()

    async def _perfil(self, identificador: UUID) -> Barber:
        perfil = await self.repositorio.profile_for_update(identificador)
        if not perfil:
            raise HTTPException(status_code=404, detail="El perfil no existe")
        return perfil

    async def _sin_citas_pendientes(self, identificador: UUID) -> None:
        resultado = await self.db.execute(select(Appointment.id).where(
            Appointment.barber_id == identificador,
            Appointment.status.in_([AppointmentStatus.pending, AppointmentStatus.confirmed]),
            Appointment.ends_at > datetime.now(timezone.utc),
        ).limit(1))
        if resultado.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Este barbero tiene citas pendientes. Debe resolverlas en su agenda antes de retirarlo o cambiar su calendario.")

    def _registrar(self, perfil: Barber, accion: str):
        AuditService(self.db).record(barber_id=self.propietario.id, action=f"team.{accion}",
            entity_type="barber", entity_id=perfil.id,
            details={"username": perfil.username})

    async def _guardar(self):
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise HTTPException(status_code=409, detail="Ese calendario ya pertenece a otro barbero activo. Cada perfil necesita su propio calendario.") from exc

    async def crear(self, datos: CrearBarbero) -> Barber:
        perfil = Barber(**datos.model_dump(exclude={"password"}),
            password_hash=await asyncio.to_thread(hash_password, datos.password),
            credentials_initialized=True, is_active=True)
        self.db.add(perfil)
        try:
            await self.db.flush()
            for dia in range(7):
                self.db.add(BusinessHour(barber_id=perfil.id, weekday=dia, is_open=dia not in (0, 6),
                    open_min=config.OPEN_MIN, close_min=config.CLOSE_MIN))
                if dia not in (0, 6):
                    self.db.add(BusinessBreak(barber_id=perfil.id, weekday=dia,
                        start_min=config.LUNCH_START, end_min=config.LUNCH_END, label="Almuerzo", is_active=True))
            self._registrar(perfil, "created")
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise HTTPException(status_code=409, detail="Ese usuario o calendario ya está asignado. Usa datos diferentes.") from exc
        await self.db.refresh(perfil)
        return perfil

    async def editar(self, identificador: UUID, datos: EditarBarbero) -> Barber:
        perfil = await self._perfil(identificador)
        if (perfil.calendar_sync, perfil.calendar_id) != (datos.calendar_sync, datos.calendar_id):
            await self._sin_citas_pendientes(perfil.id)
        for campo, valor in datos.model_dump().items():
            setattr(perfil, campo, valor)
        self._registrar(perfil, "updated")
        await self._guardar()
        return perfil

    async def retirar(self, identificador: UUID) -> Barber:
        perfil = await self._perfil(identificador)
        if perfil.username == "sebas":
            raise HTTPException(status_code=409, detail="La cuenta del propietario no se puede retirar")
        await self._sin_citas_pendientes(perfil.id)
        if perfil.is_active:
            perfil.is_active = False
            perfil.session_version += 1
            self._registrar(perfil, "retired")
        await self._guardar()
        return perfil

    async def reactivar(self, identificador: UUID) -> Barber:
        perfil = await self._perfil(identificador)
        if not perfil.credentials_initialized:
            raise HTTPException(status_code=409, detail="Este perfil no tiene una contraseña configurada")
        if not perfil.is_active:
            perfil.is_active = True
            perfil.session_version += 1
            self._registrar(perfil, "activated")
        await self._guardar()
        return perfil
