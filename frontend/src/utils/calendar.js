const SHOP_NAME = "Sebas Barber";
const LOCATION = "C. 19, Provincia de Puntarenas, Espíritu Santo, Barrio Marañonal";

function googleTimestamp(value) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function appointmentDescription(cita, barbero) {
  const extras = cita.addons?.length
    ? ` Extras: ${cita.addons.join(", ")}.`
    : "";
  return `${cita.service_name} con ${barbero?.name || "Sebas Barber"}.${extras}`;
}

export function googleCalendarUrl(cita, barbero) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${cita.service_name} | ${SHOP_NAME}`,
    dates: `${googleTimestamp(cita.starts_at)}/${googleTimestamp(cita.ends_at)}`,
    details: appointmentDescription(cita, barbero),
    location: LOCATION,
    ctz: "America/Costa_Rica",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(cita, barbero) {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: `${cita.service_name} | ${SHOP_NAME}`,
    startdt: new Date(cita.starts_at).toISOString(),
    enddt: new Date(cita.ends_at).toISOString(),
    body: appointmentDescription(cita, barbero),
    location: LOCATION,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function descargarIcs(cita, barbero) {
  const now = googleTimestamp(new Date());
  const uid = `${cita.id}@sebasbarber.vercel.app`;
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sebas Barber//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${googleTimestamp(cita.starts_at)}`,
    `DTEND:${googleTimestamp(cita.ends_at)}`,
    `SUMMARY:${escapeIcs(`${cita.service_name} | ${SHOP_NAME}`)}`,
    `DESCRIPTION:${escapeIcs(appointmentDescription(cita, barbero))}`,
    `LOCATION:${escapeIcs(LOCATION)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cita-sebas-barber-${String(cita.id).slice(0, 8)}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
