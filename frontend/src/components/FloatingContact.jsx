import { MessageCircle } from "lucide-react";

function telefonoValido(value) {
  const phone = String(value || "").replace(/\D/g, "");
  return /^[24678]\d{7}$/.test(phone) && !/^0+$/.test(phone) ? phone : "";
}

export default function FloatingContact({ barberos = [], seleccionado }) {
  const preferido = barberos.find((item) => item.id === seleccionado);
  const contacto = [preferido, ...barberos].find((item) => telefonoValido(item?.phone));
  const phone = telefonoValido(contacto?.phone);

  if (!phone) return null;

  const message = encodeURIComponent(
    `Hola, ${contacto?.name || "Sebas Barber"}. Tengo una consulta sobre una cita.`,
  );

  return (
    <a
      className="floating-contact"
      href={`https://wa.me/506${phone}?text=${message}`}
      target="_blank"
      rel="noreferrer"
      aria-label={`Escribir a ${contacto?.name || "Sebas Barber"} por WhatsApp`}
    >
      <span><MessageCircle size={20} /></span>
      <span>
        <small>¿Necesitas ayuda?</small>
        <strong>Escríbenos</strong>
      </span>
    </a>
  );
}
