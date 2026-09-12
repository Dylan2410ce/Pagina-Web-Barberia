import os
import logging
import asyncio
import httpx

logger = logging.getLogger(__name__)


class WhatsAppService:
    """
    Servicio de WhatsApp usando la API de CallMeBot (gratuita, no requiere cuenta).
    
    Para usarlo, el cliente debe registrarse una vez enviando un mensaje a CallMeBot.
    Alternativamente, si se configura Twilio, se usará Twilio.
    
    Variables de entorno:
    - WHATSAPP_PROVIDER: 'callmebot' (gratis) o 'twilio' (de pago)
    - TWILIO_ACCOUNT_SID: Solo si provider es 'twilio'
    - TWILIO_AUTH_TOKEN: Solo si provider es 'twilio'
    - TWILIO_WHATSAPP_NUMBER: Solo si provider es 'twilio'
    - CALLMEBOT_API_KEY: Clave de API de CallMeBot (si se usa)
    """

    def __init__(self):
        self.provider = os.getenv("WHATSAPP_PROVIDER", "twilio")
        # Twilio config
        self.twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.twilio_from = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")
        self.is_enabled = bool(
            (self.provider == "twilio" and self.twilio_sid and self.twilio_token)
        )

    def _format_phone(self, phone: str) -> str:
        """Formatea el número al formato internacional de Costa Rica."""
        cleaned = phone.strip().replace(" ", "").replace("-", "")
        if not cleaned.startswith("+"):
            cleaned = f"+506{cleaned}"
        return cleaned

    async def _send_twilio(self, to_phone: str, message: str) -> bool:
        formatted = f"whatsapp:{self._format_phone(to_phone)}"
        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.twilio_sid}/Messages.json"
        data = {
            "From": self.twilio_from,
            "To": formatted,
            "Body": message,
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url, data=data,
                    auth=(self.twilio_sid, self.twilio_token),
                    timeout=15.0,
                )
                if response.status_code in (200, 201):
                    logger.info(f"WhatsApp enviado a {to_phone}")
                    return True
                else:
                    logger.error(f"Error WhatsApp Twilio: {response.status_code} {response.text}")
                    return False
        except Exception as e:
            logger.error(f"Excepción enviando WhatsApp: {e}")
            return False

    async def send_message(self, to_phone: str, message: str) -> bool:
        """Envía un mensaje de WhatsApp usando el proveedor configurado."""
        if not self.is_enabled:
            logger.debug("WhatsApp deshabilitado: credenciales no configuradas.")
            return False
        return await self._send_twilio(to_phone, message)

    async def send_booking_confirmation(
        self,
        to_phone: str,
        client_name: str,
        date_str: str,
        time_str: str,
        service_name: str,
        barber_name: str,
        access_code: str,
    ) -> bool:
        """Envía mensaje de confirmación inmediata al reservar."""
        message = (
            f"✅ *¡Cita confirmada!*\n\n"
            f"Hola {client_name}, tu cita en *Sebas Barber* ha sido agendada exitosamente 💈\n\n"
            f"📅 *Fecha:* {date_str}\n"
            f"⏰ *Hora:* {time_str}\n"
            f"✂️ *Servicio:* {service_name}\n"
            f"👤 *Barbero:* {barber_name}\n"
            f"🔑 *Código de acceso:* {access_code}\n\n"
            f"📍 Barrio Marañonal, Esparza\n\n"
            f"Si necesitas cancelar o reprogramar, visita nuestra web o avísanos con anticipación.\n\n"
            f"¡Te esperamos! 🙌"
        )
        return await self.send_message(to_phone, message)

    async def send_reminder(
        self,
        to_phone: str,
        client_name: str,
        date_str: str,
        time_str: str,
        service_name: str,
        barber_name: str,
    ) -> bool:
        """Envía recordatorio 24h antes de la cita."""
        message = (
            f"⏰ *Recordatorio de cita*\n\n"
            f"Hola {client_name}, te recordamos que tienes una cita mañana en *Sebas Barber* 💈\n\n"
            f"📅 *Fecha:* {date_str}\n"
            f"⏰ *Hora:* {time_str}\n"
            f"✂️ *Servicio:* {service_name}\n"
            f"👤 *Barbero:* {barber_name}\n\n"
            f"📍 Barrio Marañonal, Esparza\n\n"
            f"¡Te esperamos! Si no puedes asistir, por favor avísanos. 🙏"
        )
        return await self.send_message(to_phone, message)


whatsapp_service = WhatsAppService()
