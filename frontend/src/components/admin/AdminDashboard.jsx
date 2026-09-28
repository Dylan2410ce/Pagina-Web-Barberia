import { ArrowRight, CalendarCheck2, CalendarClock, CalendarOff, TrendingUp, WalletCards } from "lucide-react";
import { claseEstado, dinero, fechaHumana, fechaISOCR, hoyISO, textoEstado } from "../../utils/format";
import AdminPageHead from "./AdminPageHead";
import AppointmentActions from "./AppointmentActions";

const hora = new Intl.DateTimeFormat("es-CR", { hour: "numeric", minute: "2-digit", timeZone: "America/Costa_Rica" });

export default function AdminDashboard({ data, stats, operations, perfil, onTab, onBloqueoRapido, onEstado, onMover, citas = [], fechaAgenda, cargando = false }) {
  const resumen = data || {};
  const mes = stats || {};
  const negocio = operations || {};
  const hoy = resumen.today || hoyISO();
  const proximas = resumen.upcoming || [];
  const citasHoy = (fechaAgenda === hoy ? citas : proximas)
    .filter((cita) => fechaISOCR(cita.starts_at) === hoy && !["cancelled", "blocked"].includes(cita.status))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const total = resumen.appointments_today || 0;
  const completadas = resumen.completed_today || 0;
  const progreso = total ? Math.min(100, Math.round(completadas / total * 100)) : 0;

  return <>
    <AdminPageHead eyebrow={`Tu espacio, ${perfil?.name || "barbero"}`} title="Hoy, todo en orden." text="Tu agenda y lo importante del día."
      action={<div className="admin-head-actions">
        <button className="btn btn-linea" type="button" onClick={() => onTab("bloqueos")}><CalendarOff size={18} />Bloquear horario</button>
        <button className="btn btn-principal" type="button" onClick={onBloqueoRapido}><CalendarClock size={18} />Tomar un descanso</button>
      </div>} />

    <div className="admin-metrics">
      <article><span><CalendarCheck2 size={18} />Citas de hoy</span><strong>{total}</strong><small>{completadas} atendidas · {resumen.pending_today || 0} pendientes</small></article>
      <article><span><WalletCards size={18} />Generado hoy</span><strong>{dinero(resumen.income_today || 0)}</strong><small>Solo citas completadas</small></article>
      <article><span><TrendingUp size={18} />Ingresos del mes</span><strong>{dinero(mes.income || 0)}</strong><small>{resumen.appointments_week || 0} citas esta semana</small></article>
    </div>

    <div className="dashboard-workspace">
      <section className="daily-agenda" aria-labelledby="daily-title">
        <div className="admin-panel-head"><div><span>Sin perder el ritmo</span><h2 id="daily-title">Agenda de hoy</h2></div><button className="btn btn-linea" type="button" onClick={() => onTab("agenda")}>Ver agenda <ArrowRight size={17} /></button></div>
        <div className="daily-list">
          {cargando && <div className="admin-empty" role="status"><span className="spinner" /><span>Actualizando agenda…</span></div>}
          {!cargando && citasHoy.map((cita) => <article className={`daily-appointment ${cita.status === "completed" ? "is-completed" : ""}`} key={cita.id}>
            <time dateTime={cita.starts_at}>{hora.format(new Date(cita.starts_at))}</time>
            <div className="daily-appointment-main"><span className={claseEstado(cita.status)}>{textoEstado(cita.status)}</span><h3>{cita.client_name}</h3><p>{cita.service_name}</p><span className="daily-amount">{dinero(cita.total_price)}</span></div>
            <AppointmentActions cita={cita} onEstado={onEstado} onMover={onMover} />
          </article>)}
          {!cargando && !citasHoy.length && <div className="admin-empty"><CalendarCheck2 size={28} /><strong>Hoy tienes la agenda despejada.</strong><span>Las próximas reservas aparecerán aquí.</span></div>}
        </div>
      </section>
      <aside className="day-overview">
        <h2>Así va tu día</h2><p>{completadas} de {total} citas atendidas</p>
        <progress value={progreso} max="100" aria-label="Porcentaje de citas atendidas" />
        <div className="snapshot-row"><span>Proyección de hoy</span><strong>{dinero(resumen.projected_today || 0)}</strong></div>
        <div className="snapshot-row"><span>Promedio por visita</span><strong>{dinero(mes.average_ticket || 0)}</strong></div>
        <div className="snapshot-row"><span>Más solicitado</span><strong>{resumen.top_service_week || mes.top_service || "Sin datos"}</strong></div>
        <button className="btn btn-linea btn-ancho" type="button" onClick={() => onTab("reportes")}>Ver reportes <ArrowRight size={16} /></button>
        <details className="dashboard-more"><summary>Más datos del negocio</summary><div className="snapshot-row"><span>Ingreso neto (30 días)</span><strong>{dinero(negocio.net_income || 0)}</strong></div><div className="snapshot-row"><span>Clientes recurrentes</span><strong>{negocio.repeat_rate || 0}%</strong></div><button className="btn btn-linea" type="button" onClick={() => onTab("operacion")}>Gestionar negocio</button></details>
      </aside>
    </div>
    {proximas.some((cita) => fechaISOCR(cita.starts_at) !== hoy) && <details className="future-appointments"><summary>Próximos días</summary><div className="upcoming-list">{proximas.filter((cita) => fechaISOCR(cita.starts_at) !== hoy).map((cita) => <article key={cita.id}><time dateTime={cita.starts_at}>{fechaHumana(cita.starts_at)}</time><div><strong>{cita.client_name}</strong><span>{cita.service_name}</span></div><strong>{dinero(cita.total_price)}</strong></article>)}</div></details>}
  </>;
}
