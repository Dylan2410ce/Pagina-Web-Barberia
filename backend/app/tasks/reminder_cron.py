import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, and_

from app.database import SessionLocal
from app.models import Appointment, AppointmentStatus, Barber
from app.services.whatsapp_service import whatsapp_service
from app.services.date_service import TZ

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

async def send_whatsapp_reminders():
    """
    Tarea programada para enviar recordatorios de citas
    por WhatsApp 24 horas antes.
    """
    if not whatsapp_service.is_enabled:
        logger.info("Recordatorios cron saltados: WhatsApp no está configurado.")
        return

    logger.info("Iniciando cron job de recordatorios de WhatsApp...")
    
    # Rango: Citas que ocurren dentro de las próximas 24 a 25 horas
    now = datetime.now(TZ)
    target_start = now + timedelta(hours=24)
    target_end = target_start + timedelta(hours=1)

    async with SessionLocal() as session:
        # Buscar citas confirmadas o pendientes
        result = await session.execute(
            select(Appointment, Barber.name.label("barber_name"))
            .join(Barber, Appointment.barber_id == Barber.id)
            .where(
                Appointment.starts_at >= target_start,
                Appointment.starts_at < target_end,
                Appointment.status.in_([AppointmentStatus.pending, AppointmentStatus.confirmed])
            )
        )
        
        appointments = result.all()
        
        for appt, barber_name in appointments:
            date_str = appt.starts_at.astimezone(TZ).strftime("%d/%m/%Y")
            time_str = appt.starts_at.astimezone(TZ).strftime("%I:%M %p")
            
            success = await whatsapp_service.send_reminder(
                to_phone=appt.client_phone,
                client_name=appt.client_name,
                date_str=date_str,
                time_str=time_str,
                service_name=appt.service_name,
                barber_name=barber_name
            )
            if success:
                logger.info(f"Recordatorio enviado para la cita {appt.id}")

def start_cron():
    """Inicia el cron job en el evento de inicio de FastAPI"""
    # Ejecutar cada hora
    scheduler.add_job(send_whatsapp_reminders, 'interval', hours=1)
    scheduler.start()
    logger.info("Cron job de recordatorios iniciado.")

def shutdown_cron():
    """Detiene el cron job al apagar FastAPI"""
    scheduler.shutdown()
