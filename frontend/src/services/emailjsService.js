import emailjs from "@emailjs/browser";
import { dinero, fechaHumana } from "../utils/format";

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || "";
const EMAILJS_TEMPLATE_CLIENTE = (
  import.meta.env.VITE_EMAILJS_TEMPLATE_CLIENTE
  || import.meta.env.VITE_EMAILJS_CLIENT_TEMPLATE_ID
  || ""
);
const EMAILJS_TEMPLATE_BARBERO = (
  import.meta.env.VITE_EMAILJS_TEMPLATE_BARBERO
  || import.meta.env.VITE_EMAILJS_BARBER_TEMPLATE_ID
  || ""
);
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "";
const BARBERO_EMAIL = import.meta.env.VITE_BARBERO_EMAIL || "";

const UBICACION = "C. 19, Provincia de Puntarenas, Espíritu Santo, Barrio Marañonal";
const MAPS_URL = "https://www.google.com/maps?q=10.002565,-84.657672";
const WAZE_URL = "https://waze.com/ul?ll=10.002565,-84.657672&navigate=yes";

function puedeEnviar() {
  return Boolean(
    EMAILJS_SERVICE_ID
    && EMAILJS_TEMPLATE_CLIENTE
    && EMAILJS_TEMPLATE_BARBERO
    && EMAILJS_PUBLIC_KEY
    && BARBERO_EMAIL
  );
}

function parametrosBase(cita, resumen = {}) {
  const extras = cita.addons?.length ? cita.addons.join(", ") : "Sin extras";
  return {
    appointment_id: cita.id,
    client_name: cita.client_name,
    customer_name: cita.client_name,
    client_phone: cita.client_phone,
    phone: cita.client_phone,
    client_email: cita.client_email || "",
    to_email: cita.client_email || "",
    barber_email: BARBERO_EMAIL,
    barber_name: resumen.barbero?.name || "Sebas Barber",
    barber: resumen.barbero?.name || "Sebas Barber",
    service_name: cita.service_name,
    service: cita.service_name,
    addons: extras,
    extras,
    appointment_date: fechaHumana(cita.starts_at),
    appointment_time: fechaHumana(cita.starts_at),
    starts_at: fechaHumana(cita.starts_at),
    total_price: dinero(cita.total_price),
    total: dinero(cita.total_price),
    duration: `${resumen.duracion || 45} min`,
    notes: cita.notes || "Sin notas",
    location: UBICACION,
    maps_url: MAPS_URL,
    waze_url: WAZE_URL,
    shop_name: "Sebas Barber",
  };
}

async function enviar(templateId, parametros) {
  return emailjs.send(EMAILJS_SERVICE_ID, templateId, parametros, {
    publicKey: EMAILJS_PUBLIC_KEY,
  });
}

export async function enviarCorreosCita(cita, resumen) {
  if (!puedeEnviar()) {
    console.warn("EmailJS no está configurado en este despliegue.");
    return { enviados: false, motivo: "EmailJS sin configuración completa" };
  }

  const parametros = parametrosBase(cita, resumen);
  const tareas = [
    enviar(EMAILJS_TEMPLATE_BARBERO, parametros),
  ];

  if (cita.client_email) {
    tareas.push(enviar(EMAILJS_TEMPLATE_CLIENTE, parametros));
  }

  const resultados = await Promise.allSettled(tareas);
  const fallos = resultados.filter((resultado) => resultado.status === "rejected");

  if (fallos.length) {
    console.warn("Algunos correos no se pudieron enviar con EmailJS.", fallos);
  }

  return {
    enviados: fallos.length === 0,
    total: resultados.length,
    fallos: fallos.length,
  };
}
