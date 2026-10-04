import { useRef, useState } from "react";
import { CalendarDays, Clock3, Plus, Database, XCircle, CalendarOff, Trash2 } from "lucide-react";
import { fechaHumana, fechaCorta, horaAMinutos, minutosAHora, hoyISO } from "../../utils/format";
import PageHead from "./AdminPageHead";
import EmptyState from "../ui/EmptyState";
import ScheduleImpact from "./ScheduleImpact";

export default function Bloqueos({
  perfil,
  bloqueos = [],
  ausencias = [],
  onBloqueo,
  onAusencia,
  onEliminarAusencia,
  onLiberar,
  onPreview,
}) {
  const [modo, setModo] = useState("horas");
  const [fecha, setFecha] = useState(hoyISO());
  const [inicio, setInicio] = useState("08:00");
  const [fin, setFin] = useState("09:00");
  const [motivo, setMotivo] = useState("");
  const [blockError, setBlockError] = useState("");
  const [absenceError, setAbsenceError] = useState("");
  const [revision, setRevision] = useState({});
  const [revisionAusencia, setRevisionAusencia] = useState({});
  const [guardando, setGuardando] = useState(false);
  const bloqueoEnvio = useRef(false);
  const [ausencia, setAusencia] = useState({
    start_date: hoyISO(),
    end_date: hoyISO(),
    kind: "vacation",
    title: "",
    notes: "",
  });

  const datosRevision = { start_date: fecha, end_date: fecha, all_day: modo === "dia", start_min: horaAMinutos(inicio), end_min: horaAMinutos(fin) };
  const claveRevision = JSON.stringify(datosRevision);
  const datosAusencia = { start_date: ausencia.start_date, end_date: ausencia.end_date, all_day: true };
  const claveAusencia = JSON.stringify(datosAusencia);
  const revisar = async (datos, previo, guardar) => {
    const clave = JSON.stringify(datos);
    if (previo.clave === clave && previo.resultado) return previo.resultado.total === 0;
    guardar({ clave, cargando: true });
    try { guardar({ clave, resultado: await onPreview(datos), cargando: false }); }
    catch (error) { guardar({ clave, error: error.message, cargando: false }); }
    return false;
  };
  const descanso = (duracion) => {
    const ahora = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Costa_Rica", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
    const minuto = Math.ceil(horaAMinutos(ahora) / 5) * 5;
    setFecha(hoyISO());
    usarRango(minutosAHora(Math.min(minuto, 1438)), minutosAHora(Math.min(minuto + duracion, 1439)));
  };

  const usarRango = (desde, hasta) => {
    setModo("horas");
    setInicio(desde);
    setFin(hasta);
    setBlockError("");
  };

  const guardarBloqueo = async (event) => {
    event.preventDefault();
    const startMin = horaAMinutos(inicio);
    const endMin = horaAMinutos(fin);

    if (modo === "horas" && endMin <= startMin) {
      setBlockError("La hora final debe ser posterior a la hora inicial.");
      return;
    }

    setBlockError("");
    if (bloqueoEnvio.current) return;
    bloqueoEnvio.current = true; setGuardando(true);
    try {
    if (!await revisar(datosRevision, revision, setRevision)) return;
    const guardado = await onBloqueo({
      date: fecha,
      all_day: modo === "dia",
      start_min: modo === "dia" ? 480 : startMin,
      end_min: modo === "dia" ? null : endMin,
      notes: motivo.trim() || null,
    });
    if (guardado) { setMotivo(""); setRevision({}); }
    } finally { bloqueoEnvio.current = false; setGuardando(false); }
  };

  const guardarAusencia = async (event) => {
    event.preventDefault();
    if (ausencia.end_date < ausencia.start_date) {
      setAbsenceError("La fecha final debe ser igual o posterior a la inicial.");
      return;
    }
    if (bloqueoEnvio.current) return;
    bloqueoEnvio.current = true; setGuardando(true);
    try {
    if (!await revisar(datosAusencia, revisionAusencia, setRevisionAusencia)) return;
    const guardado = await onAusencia({
      ...ausencia,
      all_day: true,
      start_min: null,
      end_min: null,
      notes: ausencia.notes.trim() || null,
    });
    if (guardado) {
      setAusencia((actual) => ({ ...actual, title: "", notes: "" }));
      setAbsenceError("");
      setRevisionAusencia({});
    }
    } finally { bloqueoEnvio.current = false; setGuardando(false); }
  };

  return (
    <>
      <PageHead eyebrow="Disponibilidad" title="Tu tiempo, organizado." text="Reserva un descanso o cierra la agenda por unos días." />
      <div className="block-admin-grid">
        <section className="admin-panel">
          <div className="segmented-control" aria-label="Tipo de bloqueo">
            <button className={modo === "horas" ? "activo" : ""} type="button" onClick={() => setModo("horas")}><Clock3 size={17} />Unas horas</button>
            <button className={modo === "dia" ? "activo" : ""} type="button" onClick={() => setModo("dia")}><CalendarDays size={17} />Día completo</button>
          </div>
          <form className="block-form" onSubmit={guardarBloqueo}>
            <div className="campo">
              <label htmlFor="block-date">Fecha</label>
              <input
                id="block-date"
                name="date"
                type="date"
                min={hoyISO()}
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
                required
              />
            </div>
            {modo === "horas" && (
              <>
                <div className="quick-ranges">
                  <button type="button" onClick={() => descanso(45)}>Descansar 45 min</button>
                  <button type="button" onClick={() => descanso(90)}>Descansar 90 min</button>
                  <button type="button" onClick={() => usarRango("08:00", "12:00")}>Mañana</button>
                  <button type="button" onClick={() => usarRango("12:00", "13:00")}>Almuerzo</button>
                  <button type="button" onClick={() => usarRango("13:00", "17:00")}>Tarde</button>
                  <button type="button" onClick={() => usarRango("17:00", "19:00")}>Cierre</button>
                </div>
                <div className="block-times">
                  <div className="campo"><label htmlFor="block-start">Desde</label><input id="block-start" name="start_time" type="time" value={inicio} onChange={(event) => setInicio(event.target.value)} required /></div>
                  <div className="campo"><label htmlFor="block-end">Hasta</label><input id="block-end" name="end_time" type="time" value={fin} onChange={(event) => setFin(event.target.value)} required /></div>
                </div>
              </>
            )}
            <div className="campo">
              <label htmlFor="block-reason">Motivo</label>
              <input
                id="block-reason"
                name="notes"
                maxLength={240}
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder={modo === "dia" ? "Ej.: descanso o vacaciones" : "Ej.: descanso o diligencia"}
              />
            </div>
            {blockError && <p className="form-error" role="alert">{blockError}</p>}
            <ScheduleImpact revision={revision} vigente={revision.clave === claveRevision} />
            <button className="btn btn-principal btn-ancho" type="submit" disabled={guardando || (revision.clave === claveRevision && revision.resultado?.total > 0)}><Plus size={17} />{revision.clave === claveRevision && revision.resultado?.total === 0 ? "Confirmar bloqueo" : "Revisar bloqueo"}</button>
          </form>
        </section>
        <section className="admin-panel calendar-panel">
          {perfil?.calendar_connected && perfil?.calendar_embed_url ? (
            <>
              <div className="admin-panel-head"><div><span>Agenda conectada</span><h2>Semana visible</h2></div></div>
              <iframe
                className="admin-calendar-frame"
                title={`Calendario de ${perfil?.name || "barbero"}`}
                src={perfil.calendar_embed_url}
                loading="lazy"
              />
            </>
          ) : (
            <div className="local-agenda-state">
              <span><Database size={24} /></span>
              <div>
                <small>Agenda no conectada</small>
                <h2>Revisa la configuración de Calendar.</h2>
                <p>Las citas siguen protegidas en el sistema, pero falta conectar el calendario de {perfil?.name || "este barbero"}.</p>
              </div>
            </div>
          )}
          <div className="block-overview">
            <div className="admin-panel-head">
              <div><span>Próximos</span><h2>Bloqueos activos</h2></div>
              <strong>{bloqueos.length}</strong>
            </div>
            <div className="block-list">
              {bloqueos.map((bloqueo) => (
                <article key={bloqueo.id}>
                  <div>
                    <strong>{fechaHumana(bloqueo.starts_at)}</strong>
                    <span>{bloqueo.notes || bloqueo.service_name}</span>
                  </div>
                  <button
                    className="icon-btn labeled-action danger"
                    type="button"
                    onClick={() => onLiberar(bloqueo.id)}
                    aria-label="Liberar horario"
                    title="Liberar horario"
                  >
                    <XCircle size={17} /><span>Liberar</span>
                  </button>
                </article>
              ))}
              {bloqueos.length === 0 && <EmptyState text="No hay bloqueos pendientes." />}
            </div>
          </div>
        </section>
      </div>
      <section className="admin-panel planned-availability">
        <div className="admin-panel-head">
          <div>
            <span>Ausencias planificadas</span>
            <h2>Feriados y vacaciones</h2>
          </div>
          <strong>{ausencias.length}</strong>
        </div>
        <div className="planned-availability-grid">
          <form className="availability-form" onSubmit={guardarAusencia}>
            <div className="form-doble">
              <div className="campo">
                <label htmlFor="absence-start">Desde</label>
                <input
                  id="absence-start"
                  type="date"
                  min={hoyISO()}
                  value={ausencia.start_date}
                  onChange={(event) => setAusencia((actual) => ({
                    ...actual,
                    start_date: event.target.value,
                    end_date: event.target.value > actual.end_date
                      ? event.target.value
                      : actual.end_date,
                  }))}
                  required
                />
              </div>
              <div className="campo">
                <label htmlFor="absence-end">Hasta</label>
                <input
                  id="absence-end"
                  type="date"
                  min={ausencia.start_date}
                  value={ausencia.end_date}
                  onChange={(event) => setAusencia((actual) => ({
                    ...actual,
                    end_date: event.target.value,
                  }))}
                  required
                />
              </div>
            </div>
            <div className="campo">
              <label htmlFor="absence-kind">Tipo</label>
              <select
                id="absence-kind"
                value={ausencia.kind}
                onChange={(event) => setAusencia((actual) => ({
                  ...actual,
                  kind: event.target.value,
                }))}
              >
                <option value="vacation">Vacaciones</option>
                <option value="holiday">Feriado</option>
                <option value="personal">Asunto personal</option>
                <option value="custom">Otro cierre</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="absence-title">Nombre</label>
              <input
                id="absence-title"
                value={ausencia.title}
                maxLength={120}
                placeholder="Ej.: vacaciones de agosto"
                onChange={(event) => setAusencia((actual) => ({
                  ...actual,
                  title: event.target.value,
                }))}
                required
              />
            </div>
            <div className="campo">
              <label htmlFor="absence-notes">Nota opcional</label>
              <input
                id="absence-notes"
                value={ausencia.notes}
                maxLength={240}
                placeholder="Detalle interno"
                onChange={(event) => setAusencia((actual) => ({
                  ...actual,
                  notes: event.target.value,
                }))}
              />
            </div>
            {absenceError && <p className="form-error" role="alert">{absenceError}</p>}
            <ScheduleImpact revision={revisionAusencia} vigente={revisionAusencia.clave === claveAusencia} />
            <button className="btn btn-principal" type="submit" disabled={guardando || (revisionAusencia.clave === claveAusencia && revisionAusencia.resultado?.total > 0)}>
              <CalendarOff size={17} />
              {revisionAusencia.clave === claveAusencia && revisionAusencia.resultado?.total === 0 ? "Confirmar ausencia" : "Revisar fechas"}
            </button>
          </form>
          <div className="availability-list">
            {ausencias.map((item) => (
              <article key={item.id}>
                <span className="history-icon"><CalendarOff size={17} /></span>
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    {fechaCorta(`${item.start_date}T12:00:00`)}
                    {item.end_date !== item.start_date
                      ? ` al ${fechaCorta(`${item.end_date}T12:00:00`)}`
                      : ""}
                  </span>
                  {item.notes && <small>{item.notes}</small>}
                </div>
                <button
                  className="icon-btn labeled-action danger"
                  type="button"
                  onClick={() => onEliminarAusencia(item.id)}
                  title="Eliminar ausencia"
                  aria-label={`Eliminar ${item.title}`}
                >
                  <Trash2 size={16} /><span>Eliminar</span>
                </button>
              </article>
            ))}
            {ausencias.length === 0 && (
              <EmptyState text="No hay feriados o vacaciones programados." />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
