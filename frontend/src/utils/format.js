const TIME_ZONE = "America/Costa_Rica";

export function fechaISOCR(valor = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIME_ZONE,
  }).formatToParts(new Date(valor));
  const leer = (tipo) => partes.find((item) => item.type === tipo)?.value || "";
  return `${leer("year")}-${leer("month")}-${leer("day")}`;
}

export function dinero(valor) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(Number(valor || 0));
}

export function hoyISO() {
  return fechaISOCR();
}

export function mesActual() {
  const [year, month] = fechaISOCR().split("-").map(Number);
  return { year, month };
}

export function fechaHumana(valor) {
  if (!valor) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(valor));
}

export function fechaCorta(valor) {
  if (!valor) return "";
  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(new Date(valor));
}

export function minutosAHora(minutos) {
  const h = Math.floor(Number(minutos || 0) / 60);
  const m = Number(minutos || 0) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function horaAMinutos(valor) {
  const [h, m] = String(valor || "00:00").split(":").map(Number);
  return h * 60 + m;
}

export function limpiarTelefono(valor) {
  return String(valor || "").replace(/\D/g, "").slice(0, 8);
}

export function validarTelefono(valor) {
  return /^[24678][0-9]{7}$/.test(String(valor || ""));
}

export function textoEstado(estado) {
  const estados = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    completed: "Completada",
    cancelled: "Cancelada",
    no_show: "No asistió",
    blocked: "Bloqueada",
    booked: "Pendiente",
    present: "Completada",
    noshow: "No asistió",
  };
  return estados[estado] || estado || "Sin estado";
}

export function claseEstado(estado) {
  return `estado estado-${estado || "default"}`;
}

export function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function agruparServicios(servicios = []) {
  return {
    servicios: servicios.filter((item) => !item.is_addon && item.is_active !== false),
    extras: servicios.filter((item) => item.is_addon && item.is_active !== false),
  };
}

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export const diasSemana = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
