import emailjs from "@emailjs/browser";
import { bookingManageUrl } from "../utils/bookingLinks";
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

async function crearQrReserva(url) {
  try {
    const { toDataURL } = await import("qrcode");
    return await toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 360,
      color: {
        dark: "#171914",
        light: "#fffaf0",
      },
    });
  } catch (error) {
    console.warn("No se pudo generar el QR para el correo.", error);
    return "";
  }
}

function mensajeCliente(data) {
  return [
    `Hola, ${data.client_name}.`,
    "",
    `Tu reserva en ${SHOP_NAME} quedó registrada.`,
    "",
    `Barbero: ${data.barber_name}`,
    `Servicio: ${data.service_name}`,
    `Fecha: ${data.appointment_date}`,
    `Hora: ${data.appointment_time}`,
    `Duración: ${data.duration}`,
    `Extras: ${data.addons}`,
    `Total: ${data.total_price}`,
    `Código privado: ${data.access_code}`,
    "",
    `Ubicación: ${UBICACION}`,
    `Google Maps: ${MAPS_URL}`,
    `Waze: ${WAZE_URL}`,
    "",
    `Para consultar, mover o cancelar tu cita: ${data.manage_url}`,
    "",
    "Gracias por reservar con nosotros.",
    "",
    "Seguridad: Sebas Barber nunca solicita contraseñas ni pagos mediante enlaces enviados por correo.",
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
    `Código de reserva: ${data.access_code}`,
    `ID interno: ${data.appointment_id}`,
  ].join("\n");
}

function puedeEnviar(barberEmail = BARBERO_EMAIL) {
  return Boolean(
    EMAILJS_SERVICE_ID
    && EMAILJS_TEMPLATE_CLIENTE
    && EMAILJS_TEMPLATE_BARBERO
    && EMAILJS_PUBLIC_KEY
    && barberEmail
  );
}

export async function crearPayloadsEmail(
  cita = {},
  resumen = {},
  barberEmail = BARBERO_EMAIL,
) {
  const startsAt = new Date(cita.starts_at);
  const validDate = Number.isFinite(startsAt.getTime()) ? startsAt : new Date();
  const clientEmail = texto(cita.client_email, "");
  const barberName = texto(
    resumen?.barbero?.name || cita.barber_name,
    "Sebas Barber",
  );
  const base = {
    appointment_id: texto(cita.id, "Sin identificador"),
    access_code: texto(cita.access_code, "No disponible"),
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
    manage_url: bookingManageUrl(cita.access_code),
    from_name: SHOP_NAME,
    security_notice: (
      "Sebas Barber nunca solicita contraseñas ni pagos mediante enlaces enviados por correo."
    ),
  };

  const aliases = {
    customer_name: base.client_name,
    phone: base.client_phone,
    barber: base.barber_name,
    service: base.service_name,
    extras: base.addons,
    starts_at: base.appointment_datetime,
    total: base.total_price,
    booking_code: base.access_code,
    reservation_code: base.access_code,
  };

  const cliente = {
    ...base,
    ...aliases,
    notification_type: "client_confirmation",
    to_email: clientEmail,
    recipient_name: base.client_name,
    reply_to: base.barber_email,
    email_subject: `Recibimos tu reserva con ${base.barber_name}`,
    email_title: "Reserva recibida",
    notification_badge: "Cita confirmada",
    manage_button_label: "Ver o administrar mi cita",
    has_booking_details: true,
    has_access_code: Boolean(cita.access_code),
    has_manage_action: true,
    has_qr: Boolean(cita.access_code),
    is_confirmation: true,
    is_reminder: false,
    is_reschedule: false,
    is_cancellation: false,
    is_waitlist: false,
  };
  cliente.qr_code = cliente.has_qr
    ? await crearQrReserva(cliente.manage_url)
    : "";
  cliente.has_qr = Boolean(cliente.qr_code);
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
        blockHeadless: true,
        limitRate: {
          id: "sebas-barber-web",
          throttle: 1000,
        },
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

async function enviarLote(envios) {
  const resultados = [];
  for (const item of envios) {
    try {
      await item.promise();
      resultados.push({ destinatario: item.destinatario, enviado: true });
    } catch (error) {
      resultados.push({
        destinatario: item.destinatario,
        enviado: false,
        error,
      });
    }
    if (item !== envios.at(-1)) {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  }
  return resultados;
}

async function enviarPayloads(payloads) {
  const envios = [
    {
      destinatario: "barbero",
      promise: () => enviar(EMAILJS_TEMPLATE_BARBERO, payloads.barbero),
    },
  ];
  if (payloads.cliente.to_email) {
    envios.push({
      destinatario: "cliente",
      promise: () => enviar(EMAILJS_TEMPLATE_CLIENTE, payloads.cliente),
    });
  }
  const resultados = await enviarLote(envios);
  const fallos = resultados.filter((item) => !item.enviado);
  if (fallos.length) {
    console.warn(
      `EmailJS no pudo enviar: ${fallos.map((item) => item.destinatario).join(", ")}.`,
    );
  }
  return {
    configurado: true,
    enviados: fallos.length === 0,
    total: resultados.length,
    fallos: fallos.length,
    cliente_enviado: resultados.some(
      (item) => item.destinatario === "cliente" && item.enviado,
    ),
    barbero_enviado: resultados.some(
      (item) => item.destinatario === "barbero" && item.enviado,
    ),
  };
}

export async function enviarCorreosCita(cita, resumen) {
  const barberEmail = resumen?.barbero?.email || BARBERO_EMAIL;
  if (!puedeEnviar(barberEmail)) {
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

  const payloads = await crearPayloadsEmail(cita, resumen, barberEmail);
  return enviarPayloads(payloads);
}

export async function enviarCorreosActualizacion(cita, resumen, tipo) {
  const barberEmail = resumen?.barbero?.email || BARBERO_EMAIL;
  if (!puedeEnviar(barberEmail)) {
    return { configurado: false, enviados: false };
  }
  const payloads = await crearPayloadsEmail(cita, resumen, barberEmail);
  const cancelada = tipo === "cancelled";
  const actionLabel = cancelada ? "Cita cancelada" : "Cita reprogramada";
  const clientMessage = cancelada
    ? `Hola, ${payloads.cliente.client_name}.\n\nTu cita con ${payloads.cliente.barber_name} fue cancelada y el horario quedó liberado.`
    : `Hola, ${payloads.cliente.client_name}.\n\nTu cita fue reprogramada para el ${payloads.cliente.appointment_date} a las ${payloads.cliente.appointment_time}.`;
  const barberMessage = cancelada
    ? `${payloads.barbero.client_name} canceló la cita del ${payloads.barbero.appointment_date} a las ${payloads.barbero.appointment_time}.`
    : `${payloads.barbero.client_name} reprogramó su cita para el ${payloads.barbero.appointment_date} a las ${payloads.barbero.appointment_time}.`;
  payloads.cliente.notification_type = cancelada
    ? "client_cancellation"
    : "client_reschedule";
  payloads.cliente.email_subject = `${actionLabel} | ${SHOP_NAME}`;
  payloads.cliente.email_title = actionLabel;
  payloads.cliente.email_message = clientMessage;
  payloads.cliente.notification_badge = actionLabel;
  payloads.cliente.is_confirmation = false;
  payloads.cliente.is_reschedule = !cancelada;
  payloads.cliente.is_cancellation = cancelada;
  payloads.cliente.has_access_code = !cancelada && Boolean(cita.access_code);
  payloads.cliente.has_manage_action = !cancelada;
  payloads.cliente.has_qr = !cancelada && Boolean(payloads.cliente.qr_code);
  payloads.barbero.notification_type = cancelada
    ? "barber_cancellation"
    : "barber_reschedule";
  payloads.barbero.email_subject = `${actionLabel}: ${payloads.barbero.client_name}`;
  payloads.barbero.email_title = actionLabel;
  payloads.barbero.email_message = barberMessage;
  return enviarPayloads(payloads);
}
