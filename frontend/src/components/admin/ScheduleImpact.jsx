import { fechaHumana } from "../../utils/format";

export default function ScheduleImpact({ revision, vigente }) {
  if (!vigente) return null;
  if (revision.cargando) return <p role="status">Comprobando citas en ese intervalo…</p>;
  if (revision.error) return <p className="form-error" role="alert">{revision.error}</p>;
  if (!revision.resultado) return null;
  const { total, appointments } = revision.resultado;
  return <div className={`schedule-impact ${total ? "has-conflicts" : ""}`} role="status">
    <strong>{total ? `${total} cita${total === 1 ? "" : "s"} en este intervalo` : "No hay citas registradas en este intervalo"}</strong>
    {total > 0 ? <><p>Reprograma o cancela estas citas antes de bloquear.</p><ul>{appointments.map((cita) => <li key={cita.id}><strong>{cita.client_name}</strong><span>{fechaHumana(cita.starts_at)} · {cita.service_name}</span></li>)}</ul></> : <p>Comprueba las fechas y confirma el bloqueo. La disponibilidad se vuelve a validar al guardar.</p>}
  </div>;
}
