export const statusLabels = {
  booked: "Reservada",
  present: "Asistio",
  noshow: "No vino",
  cancelled: "Cancelada",
  blocked: "Bloqueo",
};

export const serviceMoods = ["Fresh", "Clean", "Sharp", "Color", "Glow"];

export const blockReasons = ["Descanso", "Cita fuera de web", "Diligencia", "Capacitacion", "Mantenimiento"];

export const blockTimeOptions = Array.from({ length: ((19 - 8) * 4) + 1 }, (_, index) => 480 + index * 15);

export function isClosedDay(dateValue) {
  if (!dateValue) return false;
  const day = new Date(`${dateValue}T12:00:00`).getDay();
  return day === 0 || day === 1;
}

export function hourFromMinutes(value) {
  return `${Math.floor(Number(value) / 60)}:${String(Number(value) % 60).padStart(2, "0")}`;
}

export function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function serviceGroup(service) {
  const name = normalizeText(service?.name);
  if (name.includes("barba")) return "Barba";
  if (name.includes("color") || name.includes("ceja")) return "Color";
  if (name.includes("fade") || name.includes("moderno")) return "Fade";
  return "Cortes";
}
