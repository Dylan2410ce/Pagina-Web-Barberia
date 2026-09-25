"""Despierta el mismo despachador durable; no crea un segundo canal de envio."""
import asyncio
import logging

from app.config import config
from app.database import AsyncSessionLocal
from app.services.notification_service import NotificationService

logger = logging.getLogger("sebas_barber.tasks")
_worker = None


async def run_delivery_job():
    try:
        async with AsyncSessionLocal() as db:
            return await NotificationService(db).process_due()
    except Exception as exc:
        logger.error("Despacho pendiente: %s", type(exc).__name__)


async def _poll():
    while True:
        await run_delivery_job()
        await asyncio.sleep(config.NOTIFICATION_POLL_SECONDS)


def start_cron():
    global _worker
    if _worker is None or _worker.done():
        _worker = asyncio.create_task(_poll())


async def shutdown_cron():
    global _worker
    if _worker:
        _worker.cancel()
        try:
            await _worker
        except asyncio.CancelledError:
            pass
        _worker = None
