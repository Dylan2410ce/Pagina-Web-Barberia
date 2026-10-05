import { useMemo } from "react";
import { horarioDelDia } from "../../utils/availability";

export function fechasRapidas(desde, horarios) {
  if (!desde || !horarios.length) return [];
  const fechas = [];
  const base = new Date(`${desde}T12:00:00Z`);
  for (let indice = 0; indice < 14 && fechas.length < 3; indice += 1) {
    const dia = new Date(base);
    dia.setUTCDate(base.getUTCDate() + indice);
    const fecha = dia.toISOString().slice(0, 10);
    if (!horarioDelDia(horarios, fecha)?.is_open) continue;
    fechas.push({ fecha, nombre: indice === 0 ? "Hoy" : indice === 1 ? "Mañana" : new Intl.DateTimeFormat("es-CR", { weekday: "short", timeZone: "UTC" }).format(dia),
      detalle: new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short", timeZone: "UTC" }).format(dia) });
  }
  return fechas;
}

export default function BookingDateShortcuts({ desde, horarios, seleccionada, onSeleccionar }) {
  const fechas = useMemo(() => fechasRapidas(desde, horarios), [desde, horarios]);
  return <div className="booking-date-shortcuts" role="group" aria-label="Fechas próximas">
    {fechas.map(({ fecha, nombre, detalle }) => <button type="button" key={fecha} aria-pressed={seleccionada === fecha} onClick={() => onSeleccionar(fecha)}><strong>{nombre}</strong><span>{detalle}</span></button>)}
  </div>;
}
