import {
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  CalendarOff,
  Clock3,
  Scissors,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { dinero, fechaHumana } from "../../utils/format";
import AdminPageHead from "./AdminPageHead";

export default function AdminDashboard({
  data,
  stats,
  perfil,
  onTab,
  onBloqueoRapido,
}) {
  const safe = data || {};
  const monthly = stats || {};
  const proximas = safe.upcoming || [];
  const citasHoy = safe.appointments_today || 0;
  const completadasHoy = safe.completed_today || 0;
  const progreso = citasHoy ? Math.round((completadasHoy / citasHoy) * 100) : 0;

  return (
    <>
      <AdminPageHead
        eyebrow={`Agenda de ${perfil?.name || "barbero"}`}
        title="Todo bajo control."
        text="Tu día, tus próximas citas y los números que importan."
        action={(
          <div className="admin-head-actions">
            <button className="btn btn-linea" type="button" onClick={() => onTab("bloqueos")}>
              <CalendarOff size={17} />
              Elegir horario
            </button>
            <button className="btn btn-principal" type="button" onClick={onBloqueoRapido}>
              <CalendarClock size={17} />
              Bloquear próximo espacio
            </button>
          </div>
        )}
      />

      <div className="admin-metrics admin-metrics-premium">
        <article data-accent="blue">
          <span><CalendarCheck2 size={16} />Citas para hoy</span>
          <strong>{citasHoy}</strong>
          <small>{safe.pending_today || 0} por atender</small>
        </article>
        <article data-accent="green">
          <span><CalendarClock size={16} />Citas esta semana</span>
          <strong>{safe.appointments_week || 0}</strong>
          <small>{safe.completed_week || 0} completadas</small>
        </article>
        <article data-accent="gold">
          <span><WalletCards size={16} />Generado esta semana</span>
          <strong>{dinero(safe.income_week || 0)}</strong>
          <small>{dinero(safe.projected_week || 0)} proyectado</small>
        </article>
        <article data-accent="copper">
          <span><Scissors size={16} />Más solicitado</span>
          <strong className="metric-service">{safe.top_service_week || monthly.top_service || "Sin datos"}</strong>
          <small>Demanda de la semana</small>
        </article>
      </div>

      <div className="dashboard-grid dashboard-grid-premium">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div><span>En camino</span><h2>Próximas citas</h2></div>
            <button className="btn btn-linea" type="button" onClick={() => onTab("agenda")}>
              Agenda completa <ArrowRight size={16} />
            </button>
          </div>
          <div className="upcoming-list admin-timeline-preview">
            {proximas.slice(0, 6).map((cita) => (
              <article key={cita.id}>
                <div className="time-badge"><Clock3 size={16} /></div>
                <div>
                  <strong>{cita.client_name}</strong>
                  <span>{cita.service_name}</span>
                </div>
                <div>
                  <strong>{fechaHumana(cita.starts_at)}</strong>
                  <small>{dinero(cita.total_price)}</small>
                </div>
              </article>
            ))}
            {proximas.length === 0 && (
              <div className="admin-empty">
                <CalendarCheck2 size={24} />
                <span>No hay citas próximas.</span>
              </div>
            )}
          </div>
        </section>

        <aside className="admin-panel month-snapshot">
          <div className="admin-panel-head">
            <div><span>Ritmo de hoy</span><h2>{progreso}% completado</h2></div>
            <TrendingUp size={20} />
          </div>
          <div className="day-progress" aria-label={`${progreso}% de las citas de hoy completadas`}>
            <i style={{ width: `${progreso}%` }} />
          </div>
          <div className="snapshot-row"><span>Generado hoy</span><strong>{dinero(safe.income_today || 0)}</strong></div>
          <div className="snapshot-row"><span>Proyección de hoy</span><strong>{dinero(safe.projected_today || 0)}</strong></div>
          <div className="snapshot-row"><span>Generado este mes</span><strong>{dinero(monthly.income || 0)}</strong></div>
          <div className="snapshot-row"><span>Ticket promedio</span><strong>{dinero(monthly.average_ticket || 0)}</strong></div>
          <button className="btn btn-secundario btn-ancho" type="button" onClick={() => onTab("reportes")}>
            Ver reportes del mes
          </button>
        </aside>
      </div>
    </>
  );
}
