"""Envío transaccional a Brevo; la API key vive solo en Render."""
import json
import logging
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import config
from app.services.emailjs_service import EmailJSError, EmailJSService

logger = logging.getLogger("sebas_barber.brevo")

class BrevoEmailService(EmailJSService):
    endpoint = "https://api.brevo.com/v3/smtp/email"
    template_params = (
        "notification_badge", "email_title", "email_message", "recipient_name",
        "client_name", "barber_name", "service_name", "appointment_date",
        "appointment_time", "duration", "addons", "total_price", "access_code",
        "manage_url", "manage_button_label", "location", "maps_url", "waze_url",
        "security_notice", "client_phone", "client_email", "notes", "appointment_id",
        "sent_at",
    )

    def configuration_errors(self) -> list[str]:
        errors = []
        if not config.BREVO_API_KEY:
            errors.append("BREVO_API_KEY")
        for name in ("BREVO_TEMPLATE_CLIENTE", "BREVO_TEMPLATE_BARBERO"):
            value = getattr(config, name)
            if not value.isdigit() or int(value) <= 0:
                errors.append(name)
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", config.BREVO_SENDER_EMAIL):
            errors.append("BREVO_SENDER_EMAIL")
        return errors

    def available(self) -> bool:
        return not self.configuration_errors()

    def template_id(self, audience: str) -> str:
        return config.BREVO_TEMPLATE_BARBERO if audience == "barbero" else config.BREVO_TEMPLATE_CLIENTE

    def send(self, template_id: str, payload: dict, *, idempotency_key: str | None = None) -> None:
        if not self.available():
            logger.error("Brevo: configuración incompleta o inválida | variables=%s", ",".join(self.configuration_errors()))
            raise EmailJSError("Brevo no está configurado en Render")
        try:
            numeric_template_id = int(template_id)
        except (TypeError, ValueError) as exc:
            raise EmailJSError("La plantilla de Brevo debe usar su ID numérico") from exc

        recipient = str(payload.get("to_email") or "").strip()
        if numeric_template_id <= 0:
            raise EmailJSError("La plantilla de Brevo debe usar un ID positivo")
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", recipient):
            raise EmailJSError("La notificación no tiene un correo destinatario válido")

        # Brevo escapa sus variables: enviamos texto sin doble codificación HTML.
        params = {
            key: str(payload.get(key) or "")
            for key in self.template_params
        }
        body = {
            "sender": {"name": config.BREVO_SENDER_NAME, "email": config.BREVO_SENDER_EMAIL},
            "to": [{"email": recipient, "name": str(payload.get("recipient_name") or "")}],
            "subject": str(payload.get("email_subject") or "Información de Sebas Barber"),
            "templateId": numeric_template_id,
            "params": params,
        }
        reply_to = str(payload.get("reply_to") or "").strip()
        if reply_to and re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", reply_to):
            body["replyTo"] = {"email": reply_to}
        if idempotency_key:
            body["headers"] = {"idempotencyKey": idempotency_key}

        request = Request(
            self.endpoint,
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            headers={
                "api-key": config.BREVO_API_KEY,
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "SebasBarber-API/5.3",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=12) as response:
                if response.status < 200 or response.status >= 300:
                    raise EmailJSError(f"Brevo respondió con estado {response.status}", uncertain=True)
                try:
                    result = json.loads(response.read(8192))
                except (ValueError, TypeError) as exc:
                    raise EmailJSError("Brevo aceptó la solicitud sin una confirmación válida", uncertain=True) from exc
                if not isinstance(result, dict) or not result.get("messageId"):
                    raise EmailJSError("Brevo no devolvió la confirmación del mensaje", uncertain=True)
                logger.info("Brevo: envío aceptado | status=%s template=%s", response.status, numeric_template_id)
        except HTTPError as exc:
            code = "unknown"
            try:
                candidate = json.loads(exc.read(8192)).get("code")
                if candidate in {"invalid_parameter", "missing_parameter", "unauthorized", "permission_denied", "not_enough_credits", "duplicate_parameter", "too_many_requests"}:
                    code = candidate
            except (ValueError, TypeError, AttributeError, OSError):
                pass
            logger.error("Brevo: envío rechazado | status=%s code=%s template=%s", exc.code, code, numeric_template_id)
            raise EmailJSError(
                f"Brevo rechazó el envío (HTTP {exc.code}, código {code})",
                retryable=exc.code == 429,
                uncertain=exc.code >= 500,
            ) from exc
        except (URLError, TimeoutError, OSError) as exc:
            logger.warning("Brevo: resultado de envío incierto | tipo=%s template=%s", type(exc).__name__, numeric_template_id)
            raise EmailJSError("Brevo no confirmó el envío", uncertain=True) from exc
