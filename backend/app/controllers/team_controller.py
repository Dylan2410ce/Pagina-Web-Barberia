from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Barber
from app.schemas_team import CrearBarbero, EditarBarbero, EquipoOut
from app.services.auth_service import current_barber
from app.services.team_service import EquipoService, exigir_propietario
from app.services.row_security import configurar_contexto

router = APIRouter(prefix="/api/admin/team", tags=["Equipo"])


async def propietario(barbero: Barber = Depends(current_barber), db: AsyncSession = Depends(get_db)) -> Barber:
    propietario_verificado = exigir_propietario(barbero)
    # Solo la gestión de equipo autorizada puede crear horarios de otros perfiles.
    await configurar_contexto(db, "system")
    return propietario_verificado


@router.get("", response_model=list[EquipoOut])
async def listar(db: AsyncSession = Depends(get_db), usuario: Barber = Depends(propietario)):
    return await EquipoService(db, usuario).listar()


@router.post("", response_model=EquipoOut, status_code=201)
async def crear(datos: CrearBarbero, db: AsyncSession = Depends(get_db), usuario: Barber = Depends(propietario)):
    return await EquipoService(db, usuario).crear(datos)


@router.put("/{identificador}", response_model=EquipoOut)
async def editar(identificador: UUID, datos: EditarBarbero, db: AsyncSession = Depends(get_db), usuario: Barber = Depends(propietario)):
    return await EquipoService(db, usuario).editar(identificador, datos)


@router.delete("/{identificador}", response_model=EquipoOut)
async def retirar(identificador: UUID, db: AsyncSession = Depends(get_db), usuario: Barber = Depends(propietario)):
    return await EquipoService(db, usuario).retirar(identificador)


@router.post("/{identificador}/activate", response_model=EquipoOut)
async def reactivar(identificador: UUID, db: AsyncSession = Depends(get_db), usuario: Barber = Depends(propietario)):
    return await EquipoService(db, usuario).reactivar(identificador)
