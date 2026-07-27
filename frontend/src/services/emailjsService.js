import emailjs from "@emailjs/browser";
import { dinero } from "../utils/format";

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

const TIME_ZONE = "America/Costa_Rica";
const SHOP_NAME = "Sebas Barber";
const UBICACION = "C. 19, Provincia de Puntarenas, Espíritu Santo, Barrio Marañonal";
const MAPS_URL = "https://www.google.com/maps?q=10.002565,-84.657672";
const WAZE_URL = "https://waze.com/ul?ll=10.002565,-84.657672&navigate=yes";
const EMAIL_TIMEOUT_MS = 12_000;

const dateFormatter = new Intl.DateTimeFormat("es-CR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat("es-CR", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TIME_ZONE,
});

function texto(value, fallback) {
  const cleaned = String(value ?? "").trim();
  return cleaned || fallback;
}

function duracionCita(cita, resumen) {
  const configured = Number(resumen?.duracion || 0);
  if (configured > 0) return configured;
  const start = new Date(cita?.starts_at).getTime();
  const end = new Date(cita?.ends_at).getTime();
  const calculated = Math.round((end - start) / 60_000);
  return Number.isFinite(calculated) && calculated > 0 ? calculated : 45;
}

function extrasCita(cita, resumen) {
  const fromAppointment = Array.isArray(cita?.addons) ? cita.addons : [];
  const fromSummary = Array.isArray(resumen?.extras)
    ? resumen.extras.map((item) => item?.name).filter(Boolean)
    : [];
  const extras = fromAppointment.length ? fromAppointment : fromSummary;
  return extras.length ? extras.join(", ") : "Sin extras";
}

function manageUrl() {
  if (typeof window === "undefined") return "https://sebasbarber.vercel.app/#mis-citas";
  return `${window.location.origin}/#mis-citas`;
}

function mensajeCliente(data) {
  return [
    `Hola, ${data.client_name}.`,
    "",
    `Tu cita en ${SHOP_NAME} quedó confirmada.`,
    "",
    `Barbero: ${data.barber_name}`,
    `Servicio: ${data.service_name}`,
    `Fecha: ${data.appointment_date}`,
    `Hora: ${data.appointment_time}`,
    `Duración: ${data.duration}`,
    `Extras: ${data.addons}`,
    `Total: ${data.total_price}`,
    "",
    `Ubicación: ${UBICACION}`,
    `Google Maps: ${MAPS_URL}`,
    `Waze: ${WAZE_URL}`,
    "",
    `Para consultar, mover o cancelar tu cita: ${data.manage_url}`,
    "",
    "Gracias por reservar con nosotros.",
  ].join("\n");
}

function mensajeBarbero(data) {
  return [
    `Nueva cita para ${data.barber_name}.`,
    "",
    `Cliente: ${data.client_name}`,
    `Teléfono: ${data.client_phone}`,
    `Correo: ${data.client_email}`,
    `Servicio: ${data.service_name}`,
    `Extras: ${data.addons}`,
    `Fecha: ${data.appointment_date}`,
    `Hora: ${data.appointment_time}`,
    `Duración: ${data.duration}`,
    `Total: ${data.total_price}`,
    `Notas: ${data.notes}`,
    "",
    `Código de cita: ${data.appointment_id}`,
  ].join("\n");
}

function puedeEnviar() {
  return Boolean(
    EMAILJS_SERVICE_ID
    && EMAILJS_TEMPLATE_CLIENTE
    && EMAILJS_TEMPLATE_BARBERO
    && EMAILJS_PUBLIC_KEY
    && BARBERO_EMAIL
  );
}

export function crearPayloadsEmail(cita = {}, resumen = {}, barberEmail = BARBERO_EMAIL) {
  const startsAt = new Date(cita.starts_at);
  const validDate = Number.isFinite(startsAt.getTime()) ? startsAt : new Date();
  const clientEmail = texto(cita.client_email, "");
  const barberName = texto(
    resumen?.barbero?.name || cita.barber_name,
    "Sebas Barber",
  );
  const base = {
    appointment_id: texto(cita.id, "Sin identificador"),
    shop_name: SHOP_NAME,
    barber_name: barberName,
    barber_email: texto(barberEmail, ""),
    client_name: texto(cita.client_name, "Cliente"),
    client_phone: texto(cita.client_phone, "No indicado"),
    client_email: clientEmail || "No indicado",
    service_name: texto(cita.service_name, "Servicio no indicado"),
    addons: extrasCita(cita, resumen),
    appointment_date: dateFormatter.format(validDate),
    appointment_time: timeFormatter.format(validDate),
    appointment_datetime: `${dateFormatter.format(validDate)}, ${timeFormatter.format(validDate)}`,
    duration: `${duracionCita(cita, resumen)} min`,
    total_price: dinero(cita.total_price),
    notes: texto(cita.notes, "Sin notas"),
    location: UBICACION,
    maps_url: MAPS_URL,
    waze_url: WAZE_URL,
    manage_url: manageUrl(),
    from_name: SHOP_NAME,
  };

  const aliases = {
    customer_name: base.client_name,
    phone: base.client_phone,
    barber: base.barber_name,
    service: base.service_name,
    extras: base.addons,
    starts_at: base.appointment_datetime,
    total: base.total_price,
  };

  const cliente = {
    ...base,
    ...aliases,
    notification_type: "client_confirmation",
    to_email: clientEmail,
    recipient_name: base.client_name,
    reply_to: base.barber_email,
    email_subject: `Tu cita con ${base.barber_name} está confirmada`,
    email_title: "Reserva confirmada",
  };
  cliente.email_message = mensajeCliente(cliente);

  const barbero = {
    ...base,
    ...aliases,
    notification_type: "barber_notification",
    to_email: base.barber_email,
    recipient_name: base.barber_name,
    reply_to: clientEmail || base.barber_email,
    email_subject: `Nueva cita para ${base.barber_name}: ${base.client_name}`,
    email_title: `Nueva reserva para ${base.barber_name}`,
  };
  barbero.email_message = mensajeBarbero(barbero);

  return { cliente, barbero };
}

async function enviar(templateId, parametros) {
  let timer;
  try {
    return await Promise.race([
      emailjs.send(EMAILJS_SERVICE_ID, templateId, parametros, {
        publicKey: EMAILJS_PUBLIC_KEY,
      }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("EmailJS tardó demasiado en responder")),
          EMAIL_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function enviarCorreosCita(cita, resumen) {
  if (!puedeEnviar()) {
    console.warn("EmailJS no está configurado en este despliegue.");
    return {
      configurado: false,
      enviados: false,
      total: 0,
      fallos: 0,
      cliente_enviado: false,
      barbero_enviado: false,
    };
  }

  const payloads = crearPayloadsEmail(cita, resumen);
  const envios = [
    {
      destinatario: "barbero",
      promise: enviar(EMAILJS_TEMPLATE_BARBERO, payloads.barbero),
    },
  ];

  if (payloads.cliente.to_email) {
    envios.push({
      destinatario: "cliente",
      promise: enviar(EMAILJS_TEMPLATE_CLIENTE, payloads.cliente),
    });
  }

  const resultados = await Promise.allSettled(
    envios.map((item) => item.promise),
  );
  const estado = Object.fromEntries(
    envios.map((item, index) => [
      item.destinatario,
      resultados[index].status === "fulfilled",
    ]),
  );
  const fallos = resultados.filter((resultado) => resultado.status === "rejected");

  if (fallos.length) {
    const destinatariosFallidos = envios
      .filter((_, index) => resultados[index].status === "rejected")
      .map((item) => item.destinatario)
      .join(", ");
    console.warn(`EmailJS no pudo enviar: ${destinatariosFallidos}.`);
  }

  return {
    configurado: true,
    enviados: fallos.length === 0,
    total: resultados.length,
    fallos: fallos.length,
    cliente_enviado: Boolean(estado.cliente),
    barbero_enviado: Boolean(estado.barbero),
  };
}
