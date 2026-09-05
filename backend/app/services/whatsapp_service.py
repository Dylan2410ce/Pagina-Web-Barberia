import os
import logging
import httpx
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class WhatsAppService:
    def __init__(self):
        # We assume the use of Twilio WhatsApp API as it's the standard for professional setups
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.from_number = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886") # Twilio Sandbox default
        self.is_enabled = bool(self.account_sid and self.auth_token)

    async def send_reminder(self, to_phone: str, client_name: str, date_str: str, time_str: str, service_name: str, barber_name: str) -> bool:
        """
        Sends a WhatsApp reminder to the given phone number.
        Returns True if successful, False otherwise.
        """
        if not self.is_enabled:
            logger.warning("WhatsApp Service no está configurado (TWILIO_ACCOUNT_SID faltante). Omitiendo mensaje.")
            return False

        # Formatear el número de teléfono (Twilio requiere formato whatsapp:+506...)
        formatted_phone = to_phone.strip()
        if not formatted_phone.startswith("+"):
            # Asumimos Costa Rica si no tiene código de país
            formatted_phone = f"+506{formatted_phone}"
        if not formatted_phone.startswith("whatsapp:"):
            formatted_phone = f"whatsapp:{formatted_phone}"

        message_body = (
            f"Hola {client_name}, te recordamos tu cita en *Sebas Barber* 💈\n\n"
            f"📅 Fecha: {date_str}\n"
            f"⏰ Hora: {time_str}\n"
            f"✂️ Servicio: {service_name}\n"
            f"👤 Barbero: {barber_name}\n\n"
            f"¡Te esperamos! Si necesitas cancelar o reprogramar, por favor avísanos con anticipación."
        )

        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
        data = {
            "From": self.from_number,
            "To": formatted_phone,
            "Body": message_body,
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    data=data,
                    auth=(self.account_sid, self.auth_token),
                    timeout=10.0
                )
                if response.status_code in (200, 201):
                    logger.info(f"Recordatorio de WhatsApp enviado exitosamente a {to_phone}")
                    return True
                else:
                    logger.error(f"Fallo al enviar WhatsApp: {response.text}")
                    return False
        except Exception as e:
            logger.error(f"Error enviando WhatsApp: {e}")
            return False

whatsapp_service = WhatsAppService()
