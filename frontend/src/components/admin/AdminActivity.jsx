import { History } from "lucide-react";
import { fechaHumana } from "../../utils/format";
import PageHead from "./AdminPageHead";
import EmptyState from "../ui/EmptyState";
import { useState } from "react";
import SearchToolbar from "../ui/SearchToolbar";
import { coincideBusqueda } from "../../utils/validation";

export default function Actividad({ items = [] }) {
  const [consulta, setConsulta] = useState("");
  const labels = {
    "appointment.created": "Cita creada",
    "appointment.status_changed": "Estado actualizado",
    "appointment.cancelled": "Cita cancelada",
    "appointment.rescheduled": "Cita reprogramada",
    "schedule.blocked": "Horario bloqueado",
    "availability.created": "Ausencia programada",
    "availability.deleted": "Ausencia eliminada",
    "business_hours.updated": "Horario semanal actualizado",
    "service.created": "Servicio creado",
    "service.updated": "Servicio actualizado",
    "security.password_reset": "Contraseña recuperada",
    "security.password_changed": "Contraseña actualizada",
  };
  const filtradas = items.filter((item) => coincideBusqueda(
    [labels[item.action] || item.action, item.entity_type, fechaHumana(item.created_at)], consulta,
  ));

  return (
    <>
      <PageHead
        eyebrow="Bitácora"
        title="Actividad de la cuenta"
        text="Cada cambio importante de tu agenda queda registrado."
      />
      <SearchToolbar value={consulta} onChange={setConsulta} label="Buscar actividad" count={filtradas.length} />
      <section className="admin-panel audit-list">
        {filtradas.map((item) => (
          <article key={item.id}>
            <span className="history-icon"><History size={17} /></span>
            <div>
              <strong>{labels[item.action] || item.action}</strong>
              <span>{item.entity_type}</span>
            </div>
            <time dateTime={item.created_at}>{fechaHumana(item.created_at)}</time>
          </article>
        ))}
        {filtradas.length === 0 && (
          <EmptyState text={consulta ? "No hay actividad con esta búsqueda." : "La actividad aparecerá aquí con los próximos cambios."} />
        )}
      </section>
    </>
  );
}
