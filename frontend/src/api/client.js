export const API_URL = (
  import.meta.env.VITE_API_URL
  || (import.meta.env.DEV ? "http://localhost:8000" : "")
).replace(/\/+$/, "");

const ADMIN_TOKEN_KEY = "sebas_admin_token";

export function obtenerToken() {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  return token;
}

export function guardarToken(token) {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function borrarToken() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function ejecutarSolicitud(ruta, opciones = {}) {
  if (!API_URL) {
    throw new Error("Falta configurar VITE_API_URL en Vercel.");
  }
  const controlador = new AbortController();
  const metodo = opciones.method || "GET";
  const timeout = opciones.timeout || (metodo === "GET" ? 65000 : 35000);
  const timer = setTimeout(() => controlador.abort(), timeout);
  const esFormData = (
    typeof FormData !== "undefined"
    && opciones.body instanceof FormData
  );
  const headers = {
    Accept: "application/json",
    ...(esFormData ? {} : { "Content-Type": "application/json" }),
    ...(opciones.headers || {}),
  };

  if (opciones.token) {
    headers.Authorization = `Bearer ${opciones.token}`;
  }

  try {
    const respuesta = await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers,
      body: opciones.body
        ? (esFormData ? opciones.body : JSON.stringify(opciones.body))
        : undefined,
      signal: controlador.signal,
      cache: "no-store",
    });

    if (!respuesta.ok) {
      const error = await respuesta.json().catch(() => ({}));
      const apiError = new Error(leerError(error));
      apiError.status = respuesta.status;
      throw apiError;
    }

    return respuesta.status === 204 ? null : respuesta.json();
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("La agenda tardó demasiado en responder. Intenta otra vez.");
      timeoutError.status = 408;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function api(ruta, opciones = {}) {
  const metodo = opciones.method || "GET";
  const esReservaIdempotente = (
    metodo === "POST"
    && ruta === "/api/public/appointments"
    && opciones.body?.request_id
  );
  const intentos = metodo === "GET" || esReservaIdempotente ? 2 : 1;
  let ultimoError;

  for (let intento = 0; intento < intentos; intento += 1) {
    try {
      return await ejecutarSolicitud(ruta, opciones);
    } catch (error) {
      ultimoError = error;
      const recuperable = error.name === "AbortError"
        || error instanceof TypeError
        || [502, 503, 504].includes(error.status);
      if (!recuperable || intento === intentos - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
  }

  throw ultimoError;
}

function leerError(error) {
  if (typeof error?.error?.message === "string") {
    const details = error.error.details;
    if (Array.isArray(details) && details.length > 0) {
      return `${error.error.message}: ${details.map((item) => item.message || "dato inválido").join(". ")}`;
    }
    return error.error.message;
  }
  const detalle = error?.detail;
  if (typeof detalle === "string") return detalle;
  if (Array.isArray(detalle)) {
    return detalle.map((item) => item.msg || item.message || "Dato inválido").join(" ");
  }
  if (detalle && typeof detalle === "object") {
    return detalle.msg || detalle.message || "Datos inválidos.";
  }
  return "No se pudo completar la solicitud.";
}

function query(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([clave, valor]) => {
    if (valor === undefined || valor === null || valor === "") return;
    if (Array.isArray(valor)) {
      valor.forEach((item) => q.append(clave, item));
      return;
    }
    q.set(clave, valor);
  });
  const texto = q.toString();
  return texto ? `?${texto}` : "";
}

export const publicoApi = {
  health: () => api("/health", { timeout: 65000 }),
  iniciar: () => api("/api/public/init"),
  disponibilidad: ({ barberId, fecha, serviceId, addonIds = [] }) =>
    api(
      `/api/public/availability${query({
        barber_id: barberId,
        date: fecha,
        service_id: serviceId,
        addon_ids: addonIds,
      })}`,
    ),
  crearCita: (datos) => api("/api/public/appointments", { method: "POST", body: datos }),
  buscarPorCodigo: (codigo) =>
    api(`/api/public/appointments/manage/${encodeURIComponent(codigo.trim())}`),
  historialPorCodigo: (codigo) =>
    api(`/api/public/appointments/history/${encodeURIComponent(codigo.trim())}`),
  buscarPorTelefono: (telefono) => api(`/api/public/appointments/by-phone${query({ phone: telefono })}`),
  cancelarCita: (id, datos) => api(`/api/public/appointments/${id}/cancel`, { method: "PATCH", body: datos }),
  reprogramarCita: (id, datos) => api(`/api/public/appointments/${id}/reschedule`, { method: "PATCH", body: datos }),
  estadoLocal: (barberId) => api(`/api/public/shop-status/${barberId}`),
  listaEspera: (datos) => api("/api/public/waitlist", { method: "POST", body: datos }),
  reseñas: (limit = 12) => api(`/api/public/reviews${query({ limit })}`),
  crearReseña: (datos) => api("/api/public/reviews", { method: "POST", body: datos }),
  crearEncuesta: (datos) => api("/api/public/feedback", { method: "POST", body: datos }),
};

export const adminApi = {
  login: (datos) => api("/api/admin/login", { method: "POST", body: datos }),
  perfil: (token) => api("/api/admin/me", { token }),
  dashboard: (token) => api("/api/admin/dashboard", { token }),
  citas: (token, filtros = {}) => api(`/api/admin/appointments${query(filtros)}`, { token }),
  estadoCita: (token, id, estado) =>
    api(`/api/admin/appointments/${id}/status${query({ status: estado })}`, { method: "PATCH", token }),
  moverCita: (token, id, datos) => api(`/api/admin/appointments/${id}/reschedule`, { method: "PATCH", token, body: datos }),
  crearBloqueo: (token, datos) => api("/api/admin/blocks", { method: "POST", token, body: datos }),
  bloqueoRapido: (token, datos = {}) =>
    api("/api/admin/blocks/next-available", { method: "POST", token, body: datos }),
  bloqueos: (token) => api("/api/admin/blocks", { token }),
  servicios: (token) => api("/api/admin/services", { token }),
  crearServicio: (token, datos) => api("/api/admin/services", { method: "POST", token, body: datos }),
  editarServicio: (token, id, datos) => api(`/api/admin/services/${id}`, { method: "PATCH", token, body: datos }),
  horarios: (token) => api("/api/admin/business-hours", { token }),
  editarHorario: (token, weekday, datos) =>
    api(`/api/admin/business-hours/${weekday}`, { method: "PUT", token, body: datos }),
  ausencias: (token) => api("/api/admin/availability-exceptions", { token }),
  crearAusencia: (token, datos) =>
    api("/api/admin/availability-exceptions", { method: "POST", token, body: datos }),
  eliminarAusencia: (token, id) =>
    api(`/api/admin/availability-exceptions/${id}`, { method: "DELETE", token }),
  actividad: (token) => api("/api/admin/audit-logs", { token }),
  clientes: (token) => api("/api/admin/clients", { token }),
  stats: (token, year, month) => api(`/api/admin/stats${query({ year, month })}`, { token }),
  listaEspera: (token, filtros = {}) =>
    api(`/api/admin/waitlist${query(filtros)}`, { token }),
  estadoListaEspera: (token, id, status) =>
    api(`/api/admin/waitlist/${id}/status${query({ status })}`, {
      method: "PATCH",
      token,
    }),
  reseñas: (token, status = "") =>
    api(`/api/admin/reviews${query({ status })}`, { token }),
  estadoReseña: (token, id, status) =>
    api(`/api/admin/reviews/${id}/status${query({ status })}`, {
      method: "PATCH",
      token,
    }),
  galeria: (token) => api("/api/admin/gallery", { token }),
  crearImagen: (token, datos) =>
    api("/api/admin/gallery", { method: "POST", token, body: datos }),
  subirImagen: (token, datos) =>
    api("/api/admin/gallery/upload", {
      method: "POST",
      token,
      body: datos,
      timeout: 60000,
    }),
  editarImagen: (token, id, datos) =>
    api(`/api/admin/gallery/${id}`, {
      method: "PATCH",
      token,
      body: datos,
    }),
  eliminarImagen: (token, id) =>
    api(`/api/admin/gallery/${id}`, { method: "DELETE", token }),
  resetPassword: (datos) => api("/api/admin/reset-password", { method: "POST", body: datos }),
  changePassword: (token, datos) =>
    api("/api/admin/change-password", { method: "POST", token, body: datos }),
  configuracion: (token) => api("/api/admin/settings", { token }),
  guardarConfiguracion: (token, datos) =>
    api("/api/admin/settings", { method: "PATCH", token, body: datos }),
  pausas: (token) => api("/api/admin/business-breaks", { token }),
  crearPausa: (token, datos) =>
    api("/api/admin/business-breaks", { method: "POST", token, body: datos }),
  eliminarPausa: (token, id) =>
    api(`/api/admin/business-breaks/${id}`, { method: "DELETE", token }),
  actualizarCliente: (token, id, datos) =>
    api(`/api/admin/client-profiles/${id}`, { method: "PATCH", token, body: datos }),
  anonimizarCliente: (token, id) =>
    api(`/api/admin/client-profiles/${id}/anonymize`, { method: "POST", token }),
  encuestas: (token) => api("/api/admin/feedback", { token }),
  promociones: (token) => api("/api/admin/promotions", { token }),
  crearPromocion: (token, datos) =>
    api("/api/admin/promotions", { method: "POST", token, body: datos }),
  editarPromocion: (token, id, datos) =>
    api(`/api/admin/promotions/${id}`, { method: "PATCH", token, body: datos }),
  eliminarPromocion: (token, id) =>
    api(`/api/admin/promotions/${id}`, { method: "DELETE", token }),
  gastos: (token, filtros = {}) =>
    api(`/api/admin/expenses${query(filtros)}`, { token }),
  crearGasto: (token, datos) =>
    api("/api/admin/expenses", { method: "POST", token, body: datos }),
  eliminarGasto: (token, id) =>
    api(`/api/admin/expenses/${id}`, { method: "DELETE", token }),
  cierres: (token) => api("/api/admin/cash-closes", { token }),
  crearCierre: (token, datos) =>
    api("/api/admin/cash-closes", { method: "POST", token, body: datos }),
  notificaciones: (token) => api("/api/admin/notifications", { token }),
  metricasOperativas: (token, days = 30) =>
    api(`/api/admin/operations-metrics${query({ days })}`, { token }),
  operaciones: (token) => api("/api/admin/operations-overview", { token }),
  respaldo: (token) => api("/api/admin/backup", { token }),
};
