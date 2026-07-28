from hmac import compare_digest

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import config
from app.database import get_db
from app.schemas import DataRetentionRunOut, ReminderRunOut
from app.services.reminder_service import ReminderService
from app.services.retention_service import RetentionService

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])


@router.post("/reminders", response_model=ReminderRunOut)
async def run_reminders(
    task_token: str = Header(default="", alias="X-Task-Token"),
    db: AsyncSession = Depends(get_db),
):
    if not config.REMINDER_TASK_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="La tarea de recordatorios no está configurada",
        )
    if not compare_digest(task_token, config.REMINDER_TASK_TOKEN):
        raise HTTPException(status_code=401, detail="Token de tarea inválido")
    return await ReminderService(db).process_due()


@router.post("/retention", response_model=DataRetentionRunOut)
async def run_retention(
    task_token: str = Header(default="", alias="X-Task-Token"),
    db: AsyncSession = Depends(get_db),
):
    if not config.REMINDER_TASK_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="La tarea de mantenimiento no está configurada",
        )
    if not compare_digest(task_token, config.REMINDER_TASK_TOKEN):
        raise HTTPException(status_code=401, detail="Token de tarea inválido")
    return await RetentionService(db).run()
