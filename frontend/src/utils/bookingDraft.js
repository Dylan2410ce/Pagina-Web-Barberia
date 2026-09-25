import { hoyISO } from "./format";

export const CONTACT_KEY = "sebas_booking_contact";

export function nuevoRequestId() {
  return globalThis.crypto?.randomUUID?.()
    || `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function leerContactoRecordado() {
  try {
    return JSON.parse(localStorage.getItem(CONTACT_KEY) || "{}");
  } catch {
    return {};
  }
}

function consumirCodigoUrl() {
  if (typeof window === "undefined") return "";
  const searchCode = new URLSearchParams(window.location.search).get("reserva");
  const hashQuery = window.location.hash.split("?")[1] || "";
  const codigo = new URLSearchParams(hashQuery).get("reserva") || searchCode || "";
  if (codigo) {
    const url = new URL(window.location.href);
    url.searchParams.delete("reserva");
    url.hash = "mis-citas";
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }
  return codigo;
}

const codigoInicial = consumirCodigoUrl();
export const codigoReservaDesdeUrl = () => codigoInicial;

const reservaInicial = {
  request_id: "",
  barber_id: "",
  service_id: "",
  addon_ids: [],
  date: hoyISO(),
  start_min: null,
  client_name: "",
  client_phone: "",
  client_email: "",
  notes: "",
  website: "",
};

export function nuevaReserva(recordarContacto = true) {
  const contact = recordarContacto ? leerContactoRecordado() : {};
  return {
    ...reservaInicial,
    date: hoyISO(),
    request_id: nuevoRequestId(),
    client_name: contact.client_name || "",
    client_phone: contact.client_phone || "",
    client_email: contact.client_email || "",
  };
}
