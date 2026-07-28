import { useMemo, useState } from "react";
import {
  BellRing,
  CalendarCheck2,
  Check,
  MessageCircle,
  Search,
  X,
} from "lucide-react";
import { fechaCorta } from "../../utils/format";
import AdminPageHead from "./AdminPageHead";

const labels = {
  waiting: "En espera",
  contacted: "Contactado",
  booked: "Reservó",
  cancelled: "Descartado",
};

const periods = {
  any: "Cualquier hora",
  morning: "Mañana",
  afternoon: "Tarde",
};

export default function AdminWaitlist({ items = [], onStatus }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("waiting");
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es-CR");
    return items.filter((item) => {
      const matchesStatus = !status || item.status === status;
      const content = `${item.client_name} ${item.client_phone} ${item.service_name}`
        .toLocaleLowerCase("es-CR");
      return matchesStatus && (!term || content.includes(term));
    });
  }, [items, query, status]);

  return (
    <>
      <AdminPageHead
        eyebrow="Lista de espera"
        title="Oportunidades para llenar la agenda"
        text="Contacta a quien está esperando cuando se libere un horario."
      />
      <section className="admin-panel waitlist-admin">
        <div className="admin-filters">
          <div className="filter-search">
            <Search size={17} />
            <input
              value={query}
              placeholder="Nombre, teléfono o servicio"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
            value={status}
            aria-label="Filtrar lista de espera por estado"
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Todos</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="waitlist-list">
          {visible.length === 0 && (
            <div className="admin-empty">
              <BellRing size={25} />
              <strong>No hay solicitudes con este filtro.</strong>
            </div>
          )}
          {visible.map((item) => (
            <article key={item.id}>
              <div className="waitlist-date">
                <span>{fechaCorta(`${item.desired_date}T12:00:00`)}</span>
                <small>{periods[item.preferred_period] || item.preferred_period}</small>
              </div>
              <div className="waitlist-client">
                <span className={`estado waitlist-status-${item.status}`}>
                  {labels[item.status] || item.status}
                </span>
                <h3>{item.client_name}</h3>
                <p>{item.service_name}</p>
                {item.notes && <small>{item.notes}</small>}
              </div>
              <div className="waitlist-actions">
                <a
                  className="btn btn-linea"
                  href={`https://wa.me/506${item.client_phone}?text=${encodeURIComponent(`Hola ${item.client_name}, se liberó un espacio en Sebas Barber para el ${item.desired_date}.`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={16} />
                  Escribir
                </a>
                {item.status === "waiting" && (
                  <button className="icon-btn" type="button" onClick={() => onStatus(item.id, "contacted")} title="Marcar contactado" aria-label="Marcar como contactado">
                    <Check size={17} />
                  </button>
                )}
                {["waiting", "contacted"].includes(item.status) && (
                  <button className="icon-btn success" type="button" onClick={() => onStatus(item.id, "booked")} title="Marcar reserva creada" aria-label="Marcar como reserva creada">
                    <CalendarCheck2 size={17} />
                  </button>
                )}
                {!["booked", "cancelled"].includes(item.status) && (
                  <button className="icon-btn danger" type="button" onClick={() => onStatus(item.id, "cancelled")} title="Descartar" aria-label="Descartar solicitud">
                    <X size={17} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
