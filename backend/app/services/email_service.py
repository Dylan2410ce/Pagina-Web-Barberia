from email.message import EmailMessage
import smtplib

from app.config import config


class EmailService:
    def enabled(self) -> bool:
        return (
            config.NOTIFY_EMAILS_ENABLED
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
        except Exception:
            return

    def appointment_created(self, appointment) -> None:
        self.send(
            appointment.client_email,
            "Cita confirmada - Sebas Barber",
            (
                f"Hola {appointment.client_name}, tu cita fue confirmada.\n\n"
                f"Servicio: {appointment.service_name}\n"
                f"Fecha y hora: {appointment.starts_at}\n"
                f"Total: {appointment.total_price}\n\n"
                "Ubicacion: C. 19, Espiritu Santo, Barrio Maranonal"
            ),
        )

    def appointment_cancelled(self, appointment) -> None:
        self.send(
            appointment.client_email,
            "Cita cancelada - Sebas Barber",
            f"Hola {appointment.client_name}, tu cita del {appointment.starts_at} fue cancelada.",
        )

    def appointment_rescheduled(self, appointment) -> None:
        self.send(
            appointment.client_email,
            "Cita reprogramada - Sebas Barber",
            f"Hola {appointment.client_name}, tu nueva cita quedo para {appointment.starts_at}.",
        )
