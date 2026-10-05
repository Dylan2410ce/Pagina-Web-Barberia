import BookingDetails from "./booking/BookingDetails";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BellRing, Check, CircleCheckBig, Clock3, Scissors, UserRound } from "lucide-react";
import { dinero, limpiarTelefono } from "../utils/format";
import BarberPhoto from "./BarberPhoto";
import WaitlistModal from "./WaitlistModal";
import BookingReview from "./booking/BookingReview";
import { horarioDelDia, siguienteDiaAbierto } from "../utils/availability";
import useBarberPreference from "../hooks/useBarberPreference";
import BookingDateShortcuts from "./booking/BookingDateShortcuts";

const pasos = [
  { id: 1, label: "Tu cita" },
  { id: 2, label: "Horario" },
  { id: 3, label: "Tus datos" },
];

function fechaReserva(value) {
  if (!value) return "Por elegir";
  return new Intl.DateTimeFormat("es-CR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Costa_Rica",
  }).format(new Date(`${value}T12:00:00-06:00`));
}

export default function BookingWizard({
  reserva,
  setReserva,
  resumen,
  servicios,
  extras,
  barberos,
  barbero,
  slots,
  cargandoSlots,
  minFecha,
  onFecha,
  onBarbero,
  onServicio,
  onExtra,
  onSubmit,
  onWaitlist,
  pasoSolicitado,
  recordarContacto,
  onRecordarContacto,
  recordarReserva,
  onRecordarReserva,
  horarios = [],
  errorSlots = "",
  errorReserva,
  reservaPendiente = false,
  onReintentar,
}) {
  const [paso, setPaso] = useState(1);
  const [editandoServicio, setEditandoServicio] = useState(false);
  const servicioElegido = servicios.find((item) => item.id === reserva.service_id);
  const [listaEsperaAbierta, setListaEsperaAbierta] = useState(false);
  const panelRef = useRef(null);
  const pasoAnterior = useRef(paso);
  const cerrado = horarioDelDia(horarios, reserva.date)?.is_open === false;
  const proximaFecha = reserva.date ? siguienteDiaAbierto(horarios, reserva.date) : null;
  const [recordarBarbero, setRecordarBarbero] = useBarberPreference(barberos, reserva.barber_id);

  useEffect(() => {
    if (pasoAnterior.current === paso) return;
    pasoAnterior.current = paso;
    const titulo = panelRef.current?.querySelector(".stage-heading h3");
    titulo?.focus({ preventScroll: true });
    panelRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [paso]);

  useEffect(() => {
    if ((!reserva.service_id || !reserva.barber_id) && paso > 1) setPaso(1);
    else if (reserva.start_min === null && paso > 2) setPaso(2);
  }, [paso, reserva.barber_id, reserva.service_id, reserva.start_min]);

  useEffect(() => {
    if (!pasoSolicitado?.key || !puedeAbrir(pasoSolicitado.step)) return;
    setPaso(pasoSolicitado.step);
    setEditandoServicio(false);
  }, [pasoSolicitado]);

  const actualizar = (campo, valor) => {
    setReserva((actual) => ({
      ...actual,
      [campo]: campo === "client_phone" ? limpiarTelefono(valor) : valor,
      request_id: globalThis.crypto?.randomUUID?.()
        || `web-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }));
  };

  const puedeAbrir = (numero) => {
    if (numero === 1) return true;
    if (numero === 2) {
      return Boolean(reserva.service_id && reserva.barber_id);
    }
    return Boolean(
      reserva.service_id
      && reserva.barber_id
      && reserva.start_min !== null
    );
  };

  const cambiarPaso = (numero) => {
    if (!puedeAbrir(numero)) return;
    setPaso(numero);
  };

  return (
    <section id="reserva" className="seccion reserva-section">
      <div className="cabecera-seccion reveal">
        <div>
          <span className="eyebrow">Reserva online</span>
          <h2>Tu próxima cita.</h2>
          <p>Tu corte, tu barbero, tu hora.</p>
        </div>
      </div>

      <div className={`reserva-grid ${paso === 3 ? "reserva-grid-final" : ""}`}>
        <div className="panel wizard-panel reveal" ref={panelRef}>
          {errorReserva && <div className="booking-notice" role="alert"><strong>{errorReserva.tipo === "incierto" ? "Comprobemos tu reserva" : "No pudimos confirmar ese horario"}</strong><p>{errorReserva.mensaje}</p>{errorReserva.tipo === "incierto" && <button className="btn btn-principal" type="button" onClick={() => onSubmit()}>Comprobar reserva</button>}</div>}
          <fieldset className="wizard-fields" disabled={reservaPendiente}>
          <legend className="sr-only">Reserva de cita</legend>
          <nav className="wizard-steps" aria-label="Pasos de reserva">
            {pasos.map((item) => (
              <button
                className={`${paso === item.id ? "activo" : ""} ${paso > item.id ? "completo" : ""}`}
                key={item.id}
                type="button"
                disabled={!puedeAbrir(item.id)}
                onClick={() => cambiarPaso(item.id)}
                aria-current={paso === item.id ? "step" : undefined}
              >
                <span>{paso > item.id ? <Check size={15} /> : item.id}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div
            className="wizard-progress"
            role="progressbar"
            aria-label={`Paso ${paso} de ${pasos.length}`}
            aria-valuemin="1"
            aria-valuemax={pasos.length}
            aria-valuenow={paso}
          >
            <span style={{ width: `${(paso / pasos.length) * 100}%` }} />
          </div>

          {paso === 1 && (
            <div className="wizard-stage">
              <div className="stage-heading">
                <span>1 de 3</span>
                <h3 tabIndex="-1">¿Qué te hacemos hoy?</h3>
              </div>

              <div className="booking-config-block">
                <div className="booking-config-heading">
                  <span>Servicio principal</span>
                  {servicioElegido && <button className="text-action" type="button" onClick={() => setEditandoServicio((actual) => !actual)}>{editandoServicio ? "Cerrar opciones" : "Cambiar"}</button>}
                </div>
                <div className="booking-service-picker">
                  <div className="booking-service-list">
                    {(servicioElegido && !editandoServicio ? [servicioElegido] : servicios).map((servicio) => {
                      const activo = reserva.service_id === servicio.id;
                      return (
                        <button
                          className={activo ? "activo" : ""}
                          key={servicio.id}
                          type="button"
                          aria-pressed={activo}
                          onClick={() => { onServicio(servicio.id); setEditandoServicio(false); }}
                        >
                          <span className="booking-service-check">
                            {activo ? <Check size={15} /> : <Scissors size={15} />}
                          </span>
                          <span>
                            <strong>{servicio.name}</strong>
                            <small>{servicio.duration_min} min</small>
                          </span>
                          <strong>{dinero(servicio.price)}</strong>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {extras.length > 0 && (
                <details className="booking-extras booking-config-block">
                  <summary>Extras opcionales {reserva.addon_ids.length > 0 ? `(${reserva.addon_ids.length} elegidos)` : ""}</summary>
                  <div>
                    {extras.map((extra) => {
                      const activo = reserva.addon_ids.includes(extra.id);
                      return (
                        <button
                          className={activo ? "activo" : ""}
                          key={extra.id}
                          type="button"
                          aria-pressed={activo}
                          onClick={() => onExtra(extra.id)}
                        >
                          <span>{activo ? <Check size={15} /> : null}</span>
                          <strong>{extra.name}</strong>
                          <small>+ {dinero(extra.price)}</small>
                        </button>
                      );
                    })}
                  </div>
                </details>
              )}

              <div className="booking-config-block booking-barber-picker">
                <div className="booking-config-heading">
                  <span>Barbero</span>
                </div>
                <div className="booking-barber-grid">
                  {barberos.map((item) => {
                    const activo = reserva.barber_id === item.id;
                    return (
                      <button
                        className={`booking-barber-option ${activo ? "activo" : ""}`}
                        key={item.id}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => onBarbero(item.id)}
                      >
                        <BarberPhoto nombre={item.name} foto={item.photo_url} compacta />
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.role}</small>
                        </span>
                        <CircleCheckBig size={21} />
                      </button>
                    );
                  })}
                </div>
                {reserva.barber_id && <label className="check-line barber-preference"><input type="checkbox" checked={recordarBarbero} onChange={(event) => setRecordarBarbero(event.target.checked)} />Recordar mi barbero en este dispositivo</label>}
              </div>

              {reserva.service_id && reserva.barber_id && (
                <div className="booking-choice-summary" aria-live="polite">
                  <span><Scissors size={19} /></span>
                  <div>
                    <small>Tu elección</small>
                    <strong>{resumen.servicio?.name} con {barbero?.name}</strong>
                    <span>{resumen.duracion} min · {dinero(resumen.total)}</span>
                  </div>
                  <CircleCheckBig size={21} />
                </div>
              )}

              <div className="wizard-actions wizard-actions-end">
                <button
                  className="btn btn-principal"
                  type="button"
                  onClick={() => cambiarPaso(2)}
                  disabled={!reserva.service_id || !reserva.barber_id}
                >
                  Ver horarios
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {paso === 2 && (
            <div className="wizard-stage">
              <div className="stage-heading">
                <span>2 de 3</span>
                <h3 tabIndex="-1">Elige tu hora.</h3>
                <p>Estos son los espacios libres con {barbero?.name}.</p>
              </div>
              <div className="booking-choice-summary" aria-live="polite">
                <span><Scissors size={19} /></span>
                <div>
                  <small>Tu cita</small>
                  <strong>{resumen.servicio?.name} con {barbero?.name}</strong>
                  <span>{resumen.duracion} min · {dinero(resumen.total)}</span>
                </div>
                <CircleCheckBig size={21} />
              </div>
              <div className="campo">
                <label htmlFor="booking-date">Fecha</label>
                <BookingDateShortcuts desde={minFecha} horarios={horarios} seleccionada={reserva.date} onSeleccionar={onFecha} />
                <input
                  id="booking-date"
                  type="date"
                  min={minFecha}
                  required
                  value={reserva.date}
                  onChange={(event) => onFecha(event.target.value)}
                />
              </div>
              <div className="campo">
                <label>Horas disponibles</label>
                <div className="slots">
                  {cargandoSlots && <div className="slot-skeletons" role="status"><span className="sr-only">Consultando agenda…</span>{Array.from({ length: 6 }, (_, indice) => <span key={indice} className="skeleton" />)}</div>}
                  {!cargandoSlots && slots.map((slot) => (
                    <button
                      key={slot.start_min}
                      className={`slot ${reserva.start_min === slot.start_min ? "activo" : ""}`}
                      type="button"
                      aria-pressed={reserva.start_min === slot.start_min}
                      onClick={() => setReserva((actual) => ({
                        ...actual,
                        start_min: slot.start_min,
                        request_id: globalThis.crypto?.randomUUID?.()
                          || `web-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                      }))}
                    >
                      {slot.label}
                    </button>
                  ))}
                  {!cargandoSlots && errorSlots && <div className="booking-notice" role="alert"><strong>No pudimos consultar la agenda</strong><p>{errorSlots}</p><button className="btn btn-linea" type="button" onClick={onReintentar}>Volver a intentar</button></div>}
                  {!cargandoSlots && !errorSlots && slots.length === 0 && (
                    <div className="slots-vacio slots-waitlist">
                      <BellRing size={22} />
                      <strong>{!reserva.date ? "Elige una fecha" : cerrado ? "Ese día no atendemos." : "No quedan horas disponibles para esta fecha."}</strong>
                      <span>{cerrado ? "Consulta el próximo día de atención." : "Puedes consultar otra fecha."}</span>
                      {proximaFecha && <button className="btn btn-principal" type="button" onClick={() => onFecha(proximaFecha)}>Consultar {fechaReserva(proximaFecha)}</button>}
                      {!cerrado && reserva.date && <>
                      <button
                        className="btn btn-linea"
                        type="button"
                        onClick={() => setListaEsperaAbierta(true)}
                      >
                        <BellRing size={16} />
                        Entrar a la lista de espera
                      </button>
                      </>}
                    </div>
                  )}
                </div>
              </div>
              <div className="wizard-actions">
                <button className="btn btn-linea" type="button" onClick={() => cambiarPaso(1)}>
                  <ArrowLeft size={18} />
                  Volver
                </button>
                <button
                  className="btn btn-principal"
                  type="button"
                  onClick={() => cambiarPaso(3)}
                  disabled={reserva.start_min === null || cargandoSlots || Boolean(errorSlots)}
                >
                  Continuar
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {paso === 3 && <BookingDetails reserva={reserva} actualizar={actualizar} onSubmit={onSubmit} onBack={() => cambiarPaso(2)} recordarContacto={recordarContacto} onRecordarContacto={onRecordarContacto} recordarReserva={recordarReserva} onRecordarReserva={onRecordarReserva}><BookingReview reserva={reserva} resumen={resumen} barbero={barbero} onEditar={cambiarPaso} /></BookingDetails>}
          </fieldset>

        </div>

        <aside className={`panel resumen-card reveal ${paso === 3 ? "resumen-card-final" : ""}`}>
          <span className="chip"><Clock3 size={14} />Tu reserva</span>
          <h3>{resumen.servicio?.name || "Escoge un servicio"}</h3>
          <ul>
            <li><span>Barbero</span><strong>{barbero?.name || "Por elegir"}</strong></li>
            <li><span>Fecha</span><strong>{fechaReserva(reserva.date)}</strong></li>
            <li><span>Hora</span><strong>{resumen.hora || "Por elegir"}</strong></li>
            <li><span>Duración</span><strong>{resumen.duracion || 0} min</strong></li>
          </ul>
          {resumen.extras.length > 0 && (
            <div className="resumen-extras">
              <span>Extras</span>
              <p>{resumen.extras.map((item) => item.name).join(", ")}</p>
            </div>
          )}
          {resumen.descuento > 0 && (
            <div className="resumen-promo">
              <span>{resumen.promocion}</span>
              <strong>- {dinero(resumen.descuento)}</strong>
            </div>
          )}
          <div className="resumen-total">
            <span>Total</span>
            <strong>{dinero(resumen.total)}</strong>
          </div>
          <p className="nota"><UserRound size={15} /> Llega unos minutos antes para empezar a tiempo.</p>
        </aside>
      </div>
      <WaitlistModal
        open={listaEsperaAbierta}
        reserva={reserva}
        resumen={resumen}
        onClose={() => setListaEsperaAbierta(false)}
        onSubmit={onWaitlist}
      />
    </section>
  );
}
