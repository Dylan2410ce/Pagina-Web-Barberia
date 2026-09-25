const STORAGE_KEY = "sebas_barber_reservas_v1";
const MAX_RESERVAS = 8;

function storageDisponible() {
  try { return typeof window !== "undefined" && Boolean(window.localStorage); }
  catch { return false; }
}

export function leerReservasGuardadas() {
  if (!storageDisponible()) return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value)
      ? value.filter((item) => item?.access_code).slice(0, MAX_RESERVAS)
      : [];
  } catch {
    return [];
  }
}

export function guardarReservaLocal(cita) {
  if (!storageDisponible() || !cita?.access_code) return;
  const actual = leerReservasGuardadas().filter(
    (item) => item.access_code !== cita.access_code,
  );
  const registro = {
    access_code: cita.access_code,
    appointment_id: cita.id,
    barber_id: cita.barber_id,
    service_name: cita.service_name,
    addons: cita.addons || [],
    client_name: cita.client_name,
    starts_at: cita.starts_at,
    saved_at: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([registro, ...actual].slice(0, MAX_RESERVAS)));
  } catch { /* La confirmacion sigue disponible en pantalla y por correo. */ }
}

export function eliminarReservaLocal(accessCode) {
  if (!storageDisponible()) return;
  const actual = leerReservasGuardadas().filter(
    (item) => item.access_code !== accessCode,
  );
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(actual)); } catch { /* Almacenamiento no disponible. */ }
}

export function ultimaReservaGuardada() {
  return leerReservasGuardadas()[0] || null;
}
