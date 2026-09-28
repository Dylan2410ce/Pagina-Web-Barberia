import { useState } from "react";
import { CalendarDays, Clock3, Plus, Database, XCircle, CalendarOff, Trash2 } from "lucide-react";
import { fechaHumana, fechaCorta, horaAMinutos, hoyISO } from "../../utils/format";
import PageHead from "./AdminPageHead";
import EmptyState from "../ui/EmptyState";

export default function Bloqueos({
  perfil,
  bloqueos = [],
  ausencias = [],
  onBloqueo,
  onAusencia,
  onEliminarAusencia,
  onLiberar,
}) {
  const [modo, setModo] = useState("horas");
  const [fecha, setFecha] = useState(hoyISO());
  const [inicio, setInicio] = useState("08:00");
  const [fin, setFin] = useState("09:00");
  const [motivo, setMotivo] = useState("");
  const [blockError, setBlockError] = useState("");
  const [absenceError, setAbsenceError] = useState("");
  const [ausencia, setAusencia] = useState({
    start_date: hoyISO(),
    end_date: hoyISO(),
    kind: "vacation",
    title: "",
    notes: "",
  });

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
    const guardado = await onBloqueo({
      date: fecha,
      all_day: modo === "dia",
      start_min: modo === "dia" ? 480 : startMin,
      end_min: modo === "dia" ? null : endMin,
      notes: motivo.trim() || null,
    });
    if (guardado) setMotivo("");
  };

  const guardarAusencia = async (event) => {
    event.preventDefault();
    if (ausencia.end_date < ausencia.start_date) {
      setAbsenceError("La fecha final debe ser igual o posterior a la inicial.");
      return;
    }
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
    }
  };

  return (
    <>
      <PageHead eyebrow="Disponibilidad" title="Bloquea un día o unas horas" text="Usa un cierre completo para descanso y un rango para diligencias o citas tomadas por fuera." />
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
                placeholder={modo === "dia" ? "Ej.: descanso o vacaciones" : "Ej.: cita manual o diligencia"}
              />
            </div>
            {blockError && <p className="form-error" role="alert">{blockError}</p>}
            <button className="btn btn-principal btn-ancho" type="submit"><Plus size={17} />Guardar bloqueo</button>
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
            <button className="btn btn-principal" type="submit">
              <CalendarOff size={17} />
              Guardar ausencia
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
