export const API_URL = import.meta.env.VITE_API_URL || "https://PEGA-AQUI-TU-API-DE-RENDER.onrender.com";

export async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Error en la solicitud");
  }
  return response.status === 204 ? null : response.json();
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

