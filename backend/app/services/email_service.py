from email.message import EmailMessage
import logging
import smtplib

from app.config import config
from app.services.date_service import TZ


logger = logging.getLogger("sebas_barber.email")


class EmailService:
    def enabled(self) -> bool:
        return (
            config.EMAIL_PROVIDER == "smtp"
            and config.NOTIFY_EMAILS_ENABLED
            and bool(config.SMTP_HOST)
            and bool(config.SMTP_FROM)
            and bool(config.SMTP_USER)
            and bool(config.SMTP_PASSWORD)
        )

    def send(self, to_email: str | None, subject: str, body: str) -> None:
        if not to_email or not self.enabled():
            return

        message = EmailMessage()
        message["From"] = config.SMTP_FROM
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(body)

        try:
            with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as smtp:
                smtp.starttls()
                smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
                smtp.send_message(message)
        except Exception as exc:
            logger.exception("No se pudo enviar correo a %s: %s", to_email, exc)

    def owner_email(self) -> str:
        return config.OWNER_EMAIL or config.GOOGLE_CALENDAR_ID

    def fecha_legible(self, appointment) -> str:
        return appointment.starts_at.astimezone(TZ).strftime("%d/%m/%Y %I:%M %p")

    def extras_legibles(self, appointment) -> str:
        extras = appointment.addons or []
        return ", ".join(extras) if extras else "Sin extras"

    def ubicacion(self) -> str:
        return (
            f"{config.ADDRESS}\n"
            f"Google Maps: {config.GOOGLE_MAPS_URL}\n"
            f"Waze: {config.WAZE_URL}"
        )

    def appointment_created(self, appointment) -> None:
        fecha = self.fecha_legible(appointment)
        self.send(
            appointment.client_email,
            "Tu cita en Sebas Barber esta confirmada",
            (
                f"Hola {appointment.client_name}, tu cita quedo confirmada.\n\n"
                f"Servicio: {appointment.service_name}\n"
                f"Extras: {self.extras_legibles(appointment)}\n"
                f"Fecha y hora: {fecha}\n"
                f"Total: CRC {appointment.total_price:,}\n\n"
                f"{self.ubicacion()}\n\n"
                "Te esperamos unos minutos antes de la hora."
            ),
        )
        self.send(
            self.owner_email(),
            "Nueva cita reservada - Sebas Barber",
            (
                "Se agrego una nueva cita a la agenda.\n\n"
                f"Cliente: {appointment.client_name}\n"
                f"WhatsApp: {appointment.client_phone}\n"
                f"Correo: {appointment.client_email or 'No indicado'}\n"
                f"Servicio: {appointment.service_name}\n"
                f"Extras: {self.extras_legibles(appointment)}\n"
                f"Fecha y hora: {fecha}\n"
                f"Total: CRC {appointment.total_price:,}\n"
                f"Notas: {appointment.notes or 'Sin notas'}"
            ),
        )

    def appointment_cancelled(self, appointment) -> None:
        fecha = self.fecha_legible(appointment)
        self.send(
            appointment.client_email,
            "Cita cancelada - Sebas Barber",
            f"Hola {appointment.client_name}, tu cita del {fecha} fue cancelada.",
        )
        self.send(
            self.owner_email(),
            "Cita cancelada - Sebas Barber",
            f"{appointment.client_name} cancelo la cita del {fecha}.",
        )

    def appointment_rescheduled(self, appointment) -> None:
        fecha = self.fecha_legible(appointment)
        self.send(
            appointment.client_email,
            "Cita reprogramada - Sebas Barber",
            f"Hola {appointment.client_name}, tu nueva cita quedo para {fecha}.",
        )
        self.send(
            self.owner_email(),
            "Cita reprogramada - Sebas Barber",
            f"{appointment.client_name} movio su cita. Nueva hora: {fecha}.",
        )
