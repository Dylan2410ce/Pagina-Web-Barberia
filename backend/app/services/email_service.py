from email.message import EmailMessage
import logging
import smtplib

from app.config import config
from app.services.date_service import TZ


logger = logging.getLogger("sebas_barber.email")


class EmailService:
    def smtp_available(self) -> bool:
        return (
            config.EMAIL_PROVIDER == "smtp"
            and bool(config.SMTP_HOST)
            and bool(config.SMTP_FROM)
            and bool(config.SMTP_USER)
            and bool(config.SMTP_PASSWORD)
        )

    def enabled(self) -> bool:
        return config.NOTIFY_EMAILS_ENABLED and self.smtp_available()

    def send(
        self,
        to_email: str | None,
        subject: str,
        body: str,
        *,
        reminder: bool = False,
    ) -> bool:
        provider_ready = self.smtp_available() if reminder else self.enabled()
        if not to_email or not provider_ready:
            return False

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
            return True
        except Exception as exc:
            logger.exception("No se pudo enviar correo a %s: %s", to_email, exc)
            return False

    def owner_email(self) -> str:
        return config.OWNER_EMAIL

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
            "Recibimos tu reserva en Sebas Barber",
            (
                f"Hola {appointment.client_name}, tu horario quedó apartado.\n\n"
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
                "Se agregó una nueva cita a la agenda.\n\n"
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
            f"{appointment.client_name} canceló la cita del {fecha}.",
        )

    def appointment_rescheduled(self, appointment) -> None:
        fecha = self.fecha_legible(appointment)
        self.send(
            appointment.client_email,
            "Cita reprogramada - Sebas Barber",
            f"Hola {appointment.client_name}, tu nueva cita quedó para {fecha}.",
        )
        self.send(
            self.owner_email(),
            "Cita reprogramada - Sebas Barber",
            f"{appointment.client_name} movió su cita. Nueva hora: {fecha}.",
        )

    def appointment_reminder(self, appointment) -> bool:
        fecha = self.fecha_legible(appointment)
        return self.send(
            appointment.client_email,
            "Recordatorio de tu cita - Sebas Barber",
            (
                f"Hola {appointment.client_name}, te recordamos tu cita.\n\n"
                f"Servicio: {appointment.service_name}\n"
                f"Fecha y hora: {fecha}\n"
                f"Total: CRC {appointment.total_price:,}\n\n"
                f"{self.ubicacion()}\n\n"
                "Si necesitas moverla o cancelarla, hazlo desde la sección "
                "Mis citas de la web."
            ),
            reminder=True,
        )
