export const API_URL = import.meta.env.VITE_API_URL || "https://pagina-web-barberia.onrender.com";

export async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || 18000);

  try {
    const response = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(readError(error));
    }
    return response.status === 204 ? null : response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("La API tardo demasiado. Intenta de nuevo.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function money(value) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function cleanPhone(value) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function normalizeData(data) {
  const allowed = ["sebastian", "gabriel"];
  return {
    ...data,
    barbers: (data.barbers || []).filter((barber) => allowed.includes(barber.name.toLowerCase())),
    services: data.services || [],
    addons: data.addons || [],
  };
}

function readError(error) {
  const detail = error?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || item.message || "Dato invalido").join(" ");
  }
  if (detail && typeof detail === "object") {
    return detail.msg || detail.message || "Datos invalidos. Revisa la informacion.";
  }
  return "Error en la solicitud";
}
