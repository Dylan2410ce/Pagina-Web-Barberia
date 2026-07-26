import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MoveRight,
  Search,
  XCircle,
} from "lucide-react";
import {
  claseEstado,
  dinero,
  hoyISO,
  textoEstado,
} from "../../utils/format";
import AdminPageHead from "./AdminPageHead";

const formatoDia = new Intl.DateTimeFormat("es-CR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Costa_Rica",
});

const formatoHora = new Intl.DateTimeFormat("es-CR", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Costa_Rica",
});

function moverFecha(value, amount) {
  const current = new Date(`${value || hoyISO()}T12:00:00`);
  current.setDate(current.getDate() + amount);
  const year = current.getFullYear();
  const month = String(current.getMonth() + 1).padStart(2, "0");
  const day = String(current.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AdminAgenda({ admin, onFiltrar, onEstado, onMover }) {
  const [filtros, setFiltros] = useState(admin.filtros);

  useEffect(() => {
    setFiltros(admin.filtros);
  }, [admin.filtros]);

  const resumen = useMemo(() => {
    const citas = admin.citas.filter((item) => item.status !== "blocked");
    return {
      total: citas.length,
      pendientes: citas.filter((item) => item.status === "booked").length,
      completadas: citas.filter((item) => item.status === "present").length,
    };
  }, [admin.citas]);

  const aplicar = (next) => {
    setFiltros(next);
    onFiltrar(next);
  };

  const cambiarDia = (amount) => {
    aplicar({ ...filtros, date: moverFecha(filtros.date, amount) });
  };

  const enviar = (event) => {
    event.preventDefault();
    aplicar(filtros);
  };

  const tituloFecha = formatoDia.format(new Date(`${filtros.date || hoyISO()}T12:00:00`));

  return (
    <>
      <AdminPageHead
        eyebrow="Agenda"
        title="Citas y asistencia"
        text="Revisa el día, encuentra una reserva y registra cada visita."
      />

      <section className="admin-panel agenda-panel">
        <div className="agenda-date-bar">
          <button className="icon-btn" type="button" onClick={() => cambiarDia(-1)} aria-label="Día anterior">
            <ChevronLeft size={18} />
          </button>
          <div>
            <span>Fecha seleccionada</span>
            <strong>{tituloFecha}</strong>
          </div>
          <button className="btn btn-linea" type="button" onClick={() => aplicar({ ...filtros, date: hoyISO() })}>
            Hoy
          </button>
          <button className="icon-btn" type="button" onClick={() => cambiarDia(1)} aria-label="Día siguiente">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="agenda-summary" aria-label="Resumen del día">
          <span><strong>{resumen.total}</strong> citas</span>
          <span><strong>{resumen.pendientes}</strong> pendientes</span>
          <span><strong>{resumen.completadas}</strong> completadas</span>
        </div>

        <form className="admin-filters agenda-filters" onSubmit={enviar}>
          <div className="filter-search">
            <Search size={17} />
            <input
              name="q"
              placeholder="Nombre, teléfono o servicio"
              value={filtros.q || ""}
              onChange={(event) => setFiltros((actual) => ({ ...actual, q: event.target.value }))}
            />
          </div>
          <input
            name="date"
            type="date"
            value={filtros.date || hoyISO()}
            aria-label="Fecha"
            onChange={(event) => setFiltros((actual) => ({ ...actual, date: event.target.value }))}
          />
          <select
            name="status"
            value={filtros.status || ""}
            aria-label="Estado"
            onChange={(event) => setFiltros((actual) => ({ ...actual, status: event.target.value }))}
          >
            <option value="">Todos los estados</option>
            {["booked", "present", "noshow", "cancelled", "blocked"].map((status) => (
              <option value={status} key={status}>{textoEstado(status)}</option>
            ))}
          </select>
          <button className="btn btn-principal" type="submit">Buscar</button>
        </form>

        <div className="agenda-timeline">
          {admin.citas.length === 0 && (
            <div className="admin-empty">
              <CalendarCheck2 size={25} />
              <strong>El día está libre.</strong>
              <span>No hay citas con estos filtros.</span>
            </div>
          )}
          {admin.citas.map((cita) => {
            const esBloqueo = cita.status === "blocked";
            return (
              <article className={`agenda-event ${esBloqueo ? "agenda-event-blocked" : ""}`} key={cita.id}>
                <time dateTime={cita.starts_at}>{formatoHora.format(new Date(cita.starts_at))}</time>
                <span className="agenda-event-dot" aria-hidden="true" />
                <div className="agenda-event-main">
                  <div>
                    <span className={claseEstado(cita.status)}>{textoEstado(cita.status)}</span>
                    <h3>{esBloqueo ? cita.notes || "Espacio bloqueado" : cita.client_name}</h3>
                    <p>
                      {esBloqueo
                        ? "No disponible para reservas"
                        : `${cita.service_name}${cita.addons?.length ? ` + ${cita.addons.join(", ")}` : ""}`}
                    </p>
                  </div>
                  {!esBloqueo && (
                    <div className="agenda-event-meta">
                      <a href={`tel:+506${cita.client_phone}`}>{cita.client_phone}</a>
                      <strong>{dinero(cita.total_price)}</strong>
                    </div>
                  )}
                </div>
                <div className="appointment-actions">
                  {cita.status === "booked" && (
                    <>
                      <button className="btn btn-success" type="button" onClick={() => onEstado(cita.id, "present")}>
                        <CheckCircle2 size={16} />Asistió
                      </button>
                      <button className="btn btn-linea" type="button" onClick={() => onEstado(cita.id, "noshow")}>
                        <XCircle size={16} />No asistió
                      </button>
                    </>
                  )}
                  {["booked", "blocked"].includes(cita.status) && (
                    <>
                      <button className="icon-btn" type="button" onClick={() => onMover(cita)} title="Mover" aria-label="Mover cita o bloqueo">
                        <MoveRight size={17} />
                      </button>
                      <button className="icon-btn danger" type="button" onClick={() => onEstado(cita.id, "cancelled")} title="Cancelar o liberar" aria-label="Cancelar cita o liberar bloqueo">
                        <XCircle size={17} />
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
