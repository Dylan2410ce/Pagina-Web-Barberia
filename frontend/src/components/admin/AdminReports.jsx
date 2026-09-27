import { dinero } from "../../utils/format";
import PageHead from "./AdminPageHead";
import EmptyState from "../ui/EmptyState";

export default function Reportes({ stats }) {
  const safe = stats || {};
  const serviceBreakdown = safe.service_breakdown || [];
  const dailyIncome = safe.daily_income || [];
  const maxServicio = Math.max(...serviceBreakdown.map((item) => item.count), 1);
  const maxDia = Math.max(...dailyIncome.map((item) => item.income), 1);

  return (
    <>
      <PageHead eyebrow="Reportes" title="Números del mes" text="Ingresos, asistencia y servicios con mayor movimiento." />
      <div className="admin-metrics report-metrics">
        <article><span>Generado</span><strong>{dinero(safe.income || 0)}</strong><small>{safe.attended || 0} completadas</small></article>
        <article><span>Proyectado</span><strong>{dinero(safe.projected_income || 0)}</strong><small>{safe.booked || 0} reservadas</small></article>
        <article><span>Ticket promedio</span><strong>{dinero(safe.average_ticket || 0)}</strong><small>Por visita</small></article>
        <article><span>Asistencia</span><strong>{safe.attendance_rate || 0}%</strong><small>{safe.noshow || 0} ausencias</small></article>
      </div>
      <div className="reports-grid">
        <section className="admin-panel">
          <div className="admin-panel-head"><div><span>Demanda</span><h2>Servicios más pedidos</h2></div></div>
          <div className="chart-list">
            {serviceBreakdown.map((item) => (
              <article key={item.name}>
                <div><strong>{item.name}</strong><span>{item.count} citas | {dinero(item.income)}</span></div>
                <div className="chart-track"><i style={{ width: `${Math.max((item.count / maxServicio) * 100, 6)}%` }} /></div>
              </article>
            ))}
            {serviceBreakdown.length === 0 && <EmptyState text="Aún no hay datos para este mes." />}
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-head"><div><span>Ingresos</span><h2>Movimiento diario</h2></div></div>
          <div className="chart-list">
            {dailyIncome.map((item) => (
              <article key={item.day}>
                <div><strong>Día {item.day}</strong><span>{item.count} citas | {dinero(item.income)}</span></div>
                <div className="chart-track"><i style={{ width: `${Math.max((item.income / maxDia) * 100, 6)}%` }} /></div>
              </article>
            ))}
            {dailyIncome.length === 0 && <EmptyState text="Aún no hay ingresos completados." />}
          </div>
        </section>
      </div>
    </>
  );
}
