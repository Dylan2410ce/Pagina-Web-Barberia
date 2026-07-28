import json
import logging
import threading
import time
from datetime import datetime
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from app.config import config
from app.services.date_service import TZ
from app.services.qr_service import qr_png_data_url

logger = logging.getLogger("sebas_barber.emailjs")


class EmailJSError(RuntimeError):
    pass


class EmailJSService:
    endpoint = "https://api.emailjs.com/api/v1.0/email/send"
    _send_lock = threading.Lock()
    _last_send_at = 0.0

    def available(self) -> bool:
        return bool(
            config.EMAILJS_SERVICE_ID
            and config.EMAILJS_TEMPLATE_CLIENTE
            and config.EMAILJS_PUBLIC_KEY
        )

    def send(self, template_id: str, params: dict) -> None:
        if not self.available():
            raise EmailJSError("EmailJS no está configurado en Render")
        payload = {
            "service_id": config.EMAILJS_SERVICE_ID,
            "template_id": template_id,
            "user_id": config.EMAILJS_PUBLIC_KEY,
            "template_params": params,
        }
        if config.EMAILJS_PRIVATE_KEY:
            payload["accessToken"] = config.EMAILJS_PRIVATE_KEY

        with self._send_lock:
            elapsed = time.monotonic() - self._last_send_at
            if elapsed < 1.05:
                time.sleep(1.05 - elapsed)
            request = Request(
                self.endpoint,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json, text/plain",
                    "User-Agent": "SebasBarber-API/5.2",
                },
                method="POST",
            )
            try:
                with urlopen(request, timeout=20) as response:
                    if response.status != 200:
                        raise EmailJSError(
                            f"EmailJS respondió con estado {response.status}"
                        )
                self._last_send_at = time.monotonic()
            except HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="replace")[:300]
                raise EmailJSError(
                    f"EmailJS rechazó el envío ({exc.code}): {detail}"
                ) from exc
            except (URLError, TimeoutError, OSError) as exc:
                raise EmailJSError("EmailJS no respondió a tiempo") from exc

    @staticmethod
    def appointment_payload(
        appointment,
        barber,
        *,
        notification_type: str,
        title: str,
        message: str,
        to_email: str,
    ) -> dict:
        local_start = appointment.starts_at.astimezone(TZ)
        date_text = local_start.strftime("%d/%m/%Y")
        time_text = local_start.strftime("%I:%M %p")
        access_code = getattr(appointment, "access_code", "") or ""
        manage_url = (
            f"{config.FRONTEND_URL.rstrip('/')}/"
            f"?reserva={quote(access_code, safe='')}#mis-citas"
            if access_code
            else f"{config.FRONTEND_URL.rstrip('/')}/#mis-citas"
        )
        qr_code = qr_png_data_url(manage_url) if access_code else ""
        extras = ", ".join(appointment.addons or []) or "Sin extras"
        payload = {
            "notification_type": notification_type,
            "to_email": to_email,
            "recipient_name": appointment.client_name,
            "reply_to": barber.email or config.OWNER_EMAIL,
            "from_name": config.SHOP_NAME,
            "shop_name": config.SHOP_NAME,
            "email_subject": title,
            "email_title": title,
            "email_message": message,
            "appointment_id": str(appointment.id),
            "access_code": access_code or "Guardado en tu comprobante",
            "booking_code": access_code or "Guardado en tu comprobante",
            "reservation_code": access_code or "Guardado en tu comprobante",
            "barber_name": barber.name,
            "barber": barber.name,
            "barber_email": barber.email or config.OWNER_EMAIL,
            "client_name": appointment.client_name,
            "customer_name": appointment.client_name,
            "client_phone": appointment.client_phone,
            "phone": appointment.client_phone,
            "client_email": appointment.client_email or "No indicado",
            "service_name": appointment.service_name,
            "service": appointment.service_name,
            "addons": extras,
            "extras": extras,
            "appointment_date": date_text,
            "appointment_time": time_text,
            "appointment_datetime": f"{date_text}, {time_text}",
            "starts_at": f"{date_text}, {time_text}",
            "duration": (
                f"{int((appointment.ends_at - appointment.starts_at).total_seconds() // 60)} min"
            ),
            "total_price": f"₡{appointment.total_price:,.0f}".replace(",", " "),
            "total": f"₡{appointment.total_price:,.0f}".replace(",", " "),
            "notes": appointment.notes or "Sin notas",
            "location": config.ADDRESS,
            "maps_url": config.GOOGLE_MAPS_URL,
            "waze_url": config.WAZE_URL,
            "manage_url": manage_url,
            "manage_button_label": "Ver o administrar mi cita",
            "notification_badge": "Recordatorio de cita",
            "has_booking_details": True,
            "has_access_code": bool(access_code),
            "has_manage_action": True,
            "has_qr": bool(qr_code),
            "is_confirmation": notification_type == "client_confirmation",
            "is_reminder": notification_type == "appointment_reminder",
            "is_reschedule": notification_type == "client_reschedule",
            "is_cancellation": notification_type == "client_cancellation",
            "is_waitlist": False,
            "qr_code": qr_code,
            "security_notice": (
                "Sebas Barber nunca solicita contraseñas ni pagos mediante "
                "enlaces enviados por correo."
            ),
            "sent_at": datetime.now(TZ).isoformat(),
        }
        return payload
