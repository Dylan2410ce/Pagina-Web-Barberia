import { useState } from "react";
import { ArrowRight, CalendarCheck2, CalendarOff, Check, Phone, UserRoundX } from "lucide-react";
import { claseEstado, dinero, fechaHumana, fechaISOCR, hoyISO, textoEstado } from "../../utils/format";
import AdminPageHead from "./AdminPageHead";
import AppointmentActions from "./AppointmentActions";

const hora = new Intl.DateTimeFormat("es-CR", { hour: "numeric", minute: "2-digit", timeZone: "America/Costa_Rica" });

export default function AdminDashboard({ data, perfil, onTab, onEstado, onMover, onBloqueoRapido, citas = [], fechaAgenda, cargando = false }) {
  const [vista, setVista] = useState("pendientes");
  const resumen = data || {};
  const hoy = resumen.today || hoyISO();
  const proximas = resumen.upcoming || [];
  const citasHoy = (fechaAgenda === hoy ? citas : proximas)
    .filter((cita) => fechaISOCR(cita.starts_at) === hoy && !["cancelled", "blocked"].includes(cita.status))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const total = resumen.appointments_today || 0;
  const completadas = resumen.completed_today || 0;
  const progreso = total ? Math.min(100, Math.round(completadas / total * 100)) : 0;
  const porAtender = citasHoy.filter((cita) => ["pending", "confirmed"].includes(cita.status));
  const visibles = vista === "pendientes" ? porAtender : citasHoy;
  const siguiente = !cargando && vista === "pendientes" ? porAtender[0] : null;
  const restantes = siguiente ? visibles.filter((cita) => cita.id !== siguiente.id) : visibles;

  return <>
    <AdminPageHead eyebrow={perfil?.name || "Tu panel"} title="Tu día." />

    <div className="today-strip" aria-label="Resumen de hoy">
      <div><span>Citas</span><strong>{total}</strong></div>
      <div><span>Atendidas</span><strong>{completadas}</strong></div>
      <div><span>Generado</span><strong>{dinero(resumen.income_today || 0)}</strong></div>
    </div>

    <div className="dashboard-workspace">
      <section className="daily-agenda" aria-labelledby="daily-title">
        {siguiente && <article className="next-client" aria-label="Primero por atender">
          <div className="next-client-head"><span>Primero por atender</span><time dateTime={siguiente.starts_at}>{hora.format(new Date(siguiente.starts_at))}</time></div>
          <h3>{siguiente.client_name}</h3><p>{siguiente.service_name} · {dinero(siguiente.total_price)}</p>
          <div className="next-client-actions"><button type="button" className="btn btn-principal" onClick={() => onEstado(siguiente.id, "completed")}><Check size={18} />Atendido</button><button type="button" className="btn btn-linea" onClick={() => onEstado(siguiente.id, "no_show")}><UserRoundX size={18} />No llegó</button>{/^[24678]\d{7}$/.test(siguiente.client_phone || "") && <a className="text-action" href={`tel:+506${siguiente.client_phone}`}><Phone size={17} />Llamar</a>}<button className="text-action" type="button" onClick={() => onMover(siguiente)}>Cambiar hora</button></div>
        </article>}
        <div className="admin-panel-head"><div><h2 id="daily-title">Agenda de hoy</h2></div><button className="btn btn-linea" type="button" onClick={() => onTab("agenda")}>Otra fecha <ArrowRight size={17} /></button></div>
        <div className="agenda-view-switch" role="group" aria-label="Citas de hoy"><button type="button" aria-pressed={vista === "pendientes"} onClick={() => setVista("pendientes")}>Por atender <span>{porAtender.length}</span></button><button type="button" aria-pressed={vista === "todas"} onClick={() => setVista("todas")}>Todas <span>{citasHoy.length}</span></button></div>
        <div className="daily-list">
          {cargando && <div className="admin-empty" role="status"><span className="spinner" /><span>Actualizando agenda…</span></div>}
          {!cargando && restantes.map((cita) => <article className={`daily-appointment ${cita.status === "completed" ? "is-completed" : ""}`} key={cita.id}>
            <time dateTime={cita.starts_at}>{hora.format(new Date(cita.starts_at))}</time>
            <div className="daily-appointment-main"><span className={claseEstado(cita.status)}>{textoEstado(cita.status)}</span><h3>{cita.client_name}</h3><p>{cita.service_name}</p><span className="daily-amount">{dinero(cita.total_price)}</span></div>
            <AppointmentActions cita={cita} onEstado={onEstado} onMover={onMover} />
          </article>)}
          {!cargando && !visibles.length && <div className="admin-empty"><CalendarCheck2 size={28} /><strong>{citasHoy.length ? "No quedan citas por atender." : "Hoy tienes la agenda despejada."}</strong><span>{citasHoy.length ? "Puedes revisar el día completo en Todas." : "Las próximas reservas aparecerán aquí."}</span></div>}
        </div>
      </section>
      <aside className="day-overview">
        <h2>Así va tu día</h2><p>{completadas} de {total} citas atendidas</p>
        <progress value={progreso} max="100" aria-label="Porcentaje de citas atendidas" />
        <div className="snapshot-row"><span>Proyección de hoy</span><strong>{dinero(resumen.projected_today || 0)}</strong></div>
        <div className="snapshot-row"><span>Citas de la semana</span><strong>{resumen.appointments_week || 0}</strong></div>
        <div className="snapshot-row"><span>Más solicitado</span><strong>{resumen.top_service_week || "Sin datos"}</strong></div>
        <button className="btn btn-linea btn-ancho" type="button" onClick={() => onTab("reportes")}>Ver reportes <ArrowRight size={16} /></button>
        <button className="text-action" type="button" onClick={() => onTab("operacion")}>Gastos y cierre de caja <ArrowRight size={16} /></button>
        {onBloqueoRapido && <button className="btn btn-linea btn-ancho quick-break" type="button" onClick={onBloqueoRapido}><CalendarOff size={18} />Bloquear 45 min hoy</button>}
      </aside>
    </div>
    {proximas.some((cita) => fechaISOCR(cita.starts_at) !== hoy) && <details className="future-appointments"><summary>Próximos días</summary><div className="upcoming-list">{proximas.filter((cita) => fechaISOCR(cita.starts_at) !== hoy).map((cita) => <article key={cita.id}><time dateTime={cita.starts_at}>{fechaHumana(cita.starts_at)}</time><div><strong>{cita.client_name}</strong><span>{cita.service_name}</span></div><strong>{dinero(cita.total_price)}</strong></article>)}</div></details>}
  </>;
}
