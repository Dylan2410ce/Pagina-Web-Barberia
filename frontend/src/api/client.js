export const API_URL = import.meta.env.VITE_API_URL || "https://pagina-web-barberia.onrender.com";

const ADMIN_TOKEN_KEY = "sebas_admin_token";

export function obtenerToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

export function guardarToken(token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function borrarToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function ejecutarSolicitud(ruta, opciones = {}) {
  const controlador = new AbortController();
  const metodo = opciones.method || "GET";
  const timeout = opciones.timeout || (metodo === "GET" ? 65000 : 35000);
  const timer = setTimeout(() => controlador.abort(), timeout);
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(opciones.headers || {}),
  };

  if (opciones.token) {
    headers.Authorization = `Bearer ${opciones.token}`;
  }

  try {
    const respuesta = await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers,
      body: opciones.body ? JSON.stringify(opciones.body) : undefined,
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
      const timeoutError = new Error("La agenda tardo demasiado en responder. Intenta otra vez.");
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
  const intentos = metodo === "GET" ? 2 : 1;
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
      return `${error.error.message}: ${details.map((item) => item.message || "dato invalido").join(". ")}`;
    }
    return error.error.message;
  }
  const detalle = error?.detail;
  if (typeof detalle === "string") return detalle;
  if (Array.isArray(detalle)) {
    return detalle.map((item) => item.msg || item.message || "Dato invalido").join(" ");
  }
  if (detalle && typeof detalle === "object") {
    return detalle.msg || detalle.message || "Datos invalidos.";
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
  buscarPorTelefono: (telefono) => api(`/api/public/appointments/by-phone${query({ phone: telefono })}`),
  cancelarCita: (id, datos) => api(`/api/public/appointments/${id}/cancel`, { method: "PATCH", body: datos }),
  reprogramarCita: (id, datos) => api(`/api/public/appointments/${id}/reschedule`, { method: "PATCH", body: datos }),
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
  servicios: (token) => api("/api/admin/services", { token }),
  crearServicio: (token, datos) => api("/api/admin/services", { method: "POST", token, body: datos }),
  editarServicio: (token, id, datos) => api(`/api/admin/services/${id}`, { method: "PATCH", token, body: datos }),
  horarios: (token) => api("/api/admin/business-hours", { token }),
  editarHorario: (token, weekday, datos) =>
    api(`/api/admin/business-hours/${weekday}`, { method: "PUT", token, body: datos }),
  clientes: (token) => api("/api/admin/clients", { token }),
  stats: (token, year, month) => api(`/api/admin/stats${query({ year, month })}`, { token }),
  resetPassword: (datos) => api("/api/admin/reset-password", { method: "POST", body: datos }),
};
