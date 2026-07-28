import { useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  Download,
  KeyRound,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { descargarIcs, googleCalendarUrl } from "../utils/calendar";
import {
  claseEstado,
  dinero,
  fechaHumana,
  limpiarTelefono,
  textoEstado,
} from "../utils/format";
import ReviewModal from "./ReviewModal";

function normalizeCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 35);
}

export default function ClientAppointments({
  codigo,
  setCodigo,
  telefono,
  setTelefono,
  citas,
  barberos = [],
  reservasGuardadas = [],
  fidelidad,
  onBuscarCodigo,
  onBuscarTelefono,
  onSeleccionarGuardada,
  onCancelar,
  onReprogramar,
  onRepetir,
  onReseña,
}) {
  const [mostrarAnteriores, setMostrarAnteriores] = useState(false);
  const [citaReseña, setCitaReseña] = useState(null);

  return (
    <section id="mis-citas" className="seccion bloque client-area">
      <div className="cabecera-seccion reveal">
        <div>
          <span className="eyebrow">Mis citas</span>
          <h2>Consulta tu reserva en segundos.</h2>
          <p>Usa el código privado que recibiste al confirmar.</p>
        </div>
      </div>
      <div className="client-search-layout reveal">
        <div className="client-access-panel">
          <form className="client-search" onSubmit={onBuscarCodigo}>
            <label htmlFor="lookup-code">Código de reserva</label>
            <div>
              <span className="input-icon"><KeyRound size={18} /></span>
              <input
                id="lookup-code"
                value={codigo}
                maxLength={35}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="SB-XXXX-XXXX-XXXX-XXXX"
                onChange={(event) => setCodigo(normalizeCode(event.target.value))}
                required
              />
              <button className="btn btn-principal" type="submit">
                <Search size={17} />
                Consultar
              </button>
            </div>
            <small><ShieldCheck size={14} />Solo quien tenga este código puede modificar la cita.</small>
          </form>

          {reservasGuardadas.length > 0 && (
            <div className="saved-bookings">
              <span>Guardadas en este dispositivo</span>
              {reservasGuardadas.slice(0, 3).map((item) => (
                <button
                  key={item.access_code}
                  type="button"
                  onClick={() => onSeleccionarGuardada(item.access_code)}
                >
                  <CalendarClock size={16} />
                  <span>
                    <strong>{item.service_name}</strong>
                    <small>{fechaHumana(item.starts_at)}</small>
                  </span>
                </button>
              ))}
            </div>
          )}

          <details
            className="legacy-lookup"
            open={mostrarAnteriores}
            onToggle={(event) => setMostrarAnteriores(event.currentTarget.open)}
          >
            <summary>Buscar una cita antigua por teléfono</summary>
            <form onSubmit={onBuscarTelefono}>
              <input
                id="lookup-phone"
                inputMode="numeric"
                pattern="[24678][0-9]{7}"
                maxLength={8}
                value={telefono}
                aria-label="Número de WhatsApp"
                placeholder="88887777"
                onChange={(event) => setTelefono(limpiarTelefono(event.target.value))}
                required
              />
              <button className="btn btn-linea" type="submit">Buscar</button>
            </form>
          </details>
        </div>

        <div className="lista-citas" aria-live="polite">
          {citas.length === 0 && (
            <div className="empty-appointments">
              <CalendarClock size={28} />
              <strong>Tu reserva aparecerá aquí</strong>
              <span>Escribe el código del comprobante o elige una cita guardada.</span>
            </div>
          )}
          {citas.map((cita) => {
            const barbero = barberos.find((item) => item.id === cita.barber_id);
            const activa = ["pending", "confirmed", "booked"].includes(cita.status);
            return (
              <article className="cita-card client-appointment-card" key={cita.id}>
                <header>
                  <span className={claseEstado(cita.status)}>{textoEstado(cita.status)}</span>
                  <span className="appointment-date">{fechaHumana(cita.starts_at)}</span>
                </header>
                <h3>{cita.service_name}</h3>
                <p>{barbero?.name || "Sebas Barber"} · {dinero(cita.total_price)}</p>
                {cita.addons?.length > 0 && (
                  <small>Extras: {cita.addons.join(", ")}</small>
                )}

                <div className="appointment-calendar">
                  <a
                    className="text-action"
                    href={googleCalendarUrl(cita, barbero)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <CalendarPlus size={15} />
                    Añadir a Google
                  </a>
                  <button
                    className="text-action"
                    type="button"
                    onClick={() => descargarIcs(cita, barbero)}
                  >
                    <Download size={15} />
                    Descargar .ics
                  </button>
                </div>

                {fidelidad && cita._access_code && (
                  <div className="loyalty-mini">
                    <div>
                      <span><Sparkles size={15} />Club Sebas</span>
                      <strong>
                        {fidelidad.rewards_unlocked > 0
                          && fidelidad.current_progress === 0
                          ? "Beneficio listo"
                          : fidelidad.completed_visits === 0
                            ? "Empieza con tu primera visita"
                            : `${fidelidad.current_progress} de ${fidelidad.target_visits} visitas`}
                      </strong>
                    </div>
                    <div
                      className="loyalty-track"
                      role="progressbar"
                      aria-label="Progreso de fidelidad"
                      aria-valuemin="0"
                      aria-valuemax={fidelidad.target_visits}
                      aria-valuenow={fidelidad.current_progress}
                    >
                      <span
                        style={{
                          width: `${(fidelidad.current_progress / fidelidad.target_visits) * 100}%`,
                        }}
                      />
                    </div>
                    <small>
                      {fidelidad.rewards_unlocked > 0
                        ? fidelidad.reward_label
                        : `Faltan ${fidelidad.visits_remaining} visitas`}
                    </small>
                  </div>
                )}

                <div className="acciones-card">
                  <button className="btn btn-linea" type="button" onClick={() => onRepetir(cita)}>
                    <RefreshCw size={16} />
                    Repetir
                  </button>
                  {activa && (
                    <>
                      <button className="btn btn-linea" type="button" onClick={() => onReprogramar(cita)}>
                        <CalendarClock size={16} />
                        Reprogramar
                      </button>
                      <button className="btn btn-peligro" type="button" onClick={() => onCancelar(cita)}>
                        <Trash2 size={16} />
                        Cancelar
                      </button>
                    </>
                  )}
                  {cita.status === "completed" && cita._access_code && (
                    <button className="btn btn-principal" type="button" onClick={() => setCitaReseña(cita)}>
                      <Star size={16} />
                      Dejar reseña
                    </button>
                  )}
                </div>
                {!activa && cita.status !== "completed" && (
                  <span className="nota">Esta cita ya no admite cambios.</span>
                )}
              </article>
            );
          })}
        </div>
      </div>
      {citaReseña && (
        <ReviewModal
          cita={citaReseña}
          onClose={() => setCitaReseña(null)}
          onSubmit={onReseña}
        />
      )}
    </section>
  );
}
