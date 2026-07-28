import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  Check,
  CircleCheckBig,
  Clock3,
  Scissors,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { dinero, limpiarTelefono } from "../utils/format";
import BarberPhoto from "./BarberPhoto";
import WaitlistModal from "./WaitlistModal";

const pasos = [
  { id: 1, label: "Servicio" },
  { id: 2, label: "Barbero" },
  { id: 3, label: "Fecha" },
  { id: 4, label: "Confirmación" },
];

function fechaReserva(value) {
  if (!value) return "Por elegir";
  return new Intl.DateTimeFormat("es-CR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Costa_Rica",
  }).format(new Date(`${value}T12:00:00`));
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
}) {
  const [paso, setPaso] = useState(1);
  const [listaEsperaAbierta, setListaEsperaAbierta] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!reserva.service_id && paso > 1) setPaso(1);
    else if (!reserva.barber_id && paso > 2) setPaso(2);
    else if (reserva.start_min === null && paso > 3) setPaso(3);
  }, [paso, reserva.barber_id, reserva.service_id, reserva.start_min]);

  useEffect(() => {
    if (!pasoSolicitado?.key || !puedeAbrir(pasoSolicitado.step)) return;
    setPaso(pasoSolicitado.step);
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
    if (numero === 2) return Boolean(reserva.service_id);
    if (numero === 3) return Boolean(reserva.service_id && reserva.barber_id);
    return Boolean(
      reserva.service_id
      && reserva.barber_id
      && reserva.start_min !== null
    );
  };

  const cambiarPaso = (numero) => {
    if (!puedeAbrir(numero)) return;
    setPaso(numero);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  return (
    <section id="reserva" className="seccion reserva-section">
      <div className="cabecera-seccion reveal">
        <div>
          <span className="eyebrow">Reserva online</span>
          <h2>Reserva tu espacio sin complicarte.</h2>
          <p>Elige el servicio, tu barbero y la hora que mejor te funcione.</p>
        </div>
      </div>

      <div className="reserva-grid">
        <div className="panel wizard-panel reveal" ref={panelRef}>
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
                <span>1 de 4</span>
                <h3>¿Qué te hacemos hoy?</h3>
                <p>Escoge el servicio principal y suma extras solo si los quieres.</p>
              </div>

              <div className="booking-service-picker">
                <label>Servicio principal</label>
                <div className="booking-service-list">
                  {servicios.map((servicio) => {
                    const activo = reserva.service_id === servicio.id;
                    return (
                      <button
                        className={activo ? "activo" : ""}
                        key={servicio.id}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => onServicio(servicio.id)}
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

              {extras.length > 0 && (
                <div className="booking-extras">
                  <label>Extras opcionales</label>
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
                </div>
              )}

              <button
                className="btn btn-principal btn-ancho"
                type="button"
                onClick={() => cambiarPaso(2)}
                disabled={!reserva.service_id}
              >
                Elegir barbero
                <ArrowRight size={18} />
              </button>
            </div>
          )}

          {paso === 2 && (
            <div className="wizard-stage">
              <div className="stage-heading">
                <span>2 de 4</span>
                <h3>¿Con quién te atiendes?</h3>
                <p>Elige la agenda de Sebastián o Gabriel.</p>
              </div>

              <div className="booking-choice-summary" aria-live="polite">
                <span><Scissors size={19} /></span>
                <div>
                  <small>Servicio elegido</small>
                  <strong>{resumen.servicio?.name}</strong>
                  <span>{resumen.duracion} min · {dinero(resumen.total)}</span>
                </div>
                <CircleCheckBig size={21} />
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
                      <BarberPhoto nombre={item.name} compacta />
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.role}</small>
                      </span>
                      <CircleCheckBig size={21} />
                    </button>
                  );
                })}
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
                  disabled={!reserva.barber_id}
                >
                  Elegir fecha
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {paso === 3 && (
            <div className="wizard-stage">
              <div className="stage-heading">
                <span>3 de 4</span>
                <h3>Elige tu hora.</h3>
                <p>Estos son los espacios libres con {barbero?.name}.</p>
              </div>
              <div className="campo">
                <label htmlFor="booking-date">Fecha</label>
                <input
                  id="booking-date"
                  type="date"
                  min={minFecha}
                  value={reserva.date}
                  onChange={(event) => onFecha(event.target.value)}
                />
              </div>
              <div className="campo">
                <label>Horas disponibles</label>
                <div className="slots">
                  {cargandoSlots && (
                    <div className="slots-vacio"><span className="spinner" /> Consultando agenda...</div>
                  )}
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
                  {!cargandoSlots && slots.length === 0 && (
                    <div className="slots-vacio slots-waitlist">
                      <BellRing size={22} />
                      <strong>Ese día está completo.</strong>
                      <span>Prueba otra fecha o deja tus datos por si se libera una hora.</span>
                      <button
                        className="btn btn-linea"
                        type="button"
                        onClick={() => setListaEsperaAbierta(true)}
                      >
                        <BellRing size={16} />
                        Entrar a la lista de espera
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="wizard-actions">
                <button className="btn btn-linea" type="button" onClick={() => cambiarPaso(2)}>
                  <ArrowLeft size={18} />
                  Volver
                </button>
                <button
                  className="btn btn-principal"
                  type="button"
                  onClick={() => cambiarPaso(4)}
                  disabled={reserva.start_min === null}
                >
                  Continuar
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {paso === 4 && (
            <form className="wizard-stage formulario" onSubmit={onSubmit}>
              <div className="honeypot" aria-hidden="true">
                <label htmlFor="booking-website">Sitio web</label>
                <input
                  id="booking-website"
                  name="website"
                  tabIndex="-1"
                  autoComplete="off"
                  value={reserva.website || ""}
                  onChange={(event) => actualizar("website", event.target.value)}
                />
              </div>
              <div className="stage-heading">
                <span>4 de 4</span>
                <h3>¿A nombre de quién?</h3>
                <p>Déjanos tus datos y revisa el resumen antes de confirmar.</p>
              </div>
              <div className="campo">
                <label htmlFor="client-name">Nombre completo</label>
                <input
                  id="client-name"
                  value={reserva.client_name}
                  minLength={3}
                  maxLength={80}
                  autoComplete="name"
                  required
                  placeholder="Tu nombre"
                  onChange={(event) => actualizar("client_name", event.target.value)}
                />
              </div>
              <div className="form-doble">
                <div className="campo">
                  <label htmlFor="client-phone">WhatsApp</label>
                  <input
                    id="client-phone"
                    inputMode="numeric"
                    pattern="[24678][0-9]{7}"
                    maxLength={8}
                    value={reserva.client_phone}
                    autoComplete="tel"
                    required
                    placeholder="88887777"
                    onChange={(event) => actualizar("client_phone", event.target.value)}
                  />
                </div>
                <div className="campo">
                  <label htmlFor="client-email">Correo (opcional)</label>
                  <input
                    id="client-email"
                    type="email"
                    maxLength={160}
                    value={reserva.client_email}
                    autoComplete="email"
                    placeholder="correo@ejemplo.com"
                    onChange={(event) => actualizar("client_email", event.target.value)}
                  />
                </div>
              </div>
              <div className="campo">
                <label htmlFor="client-notes">Detalle del corte (opcional)</label>
                <input
                  id="client-notes"
                  maxLength={240}
                  value={reserva.notes}
                  placeholder="Ej.: bajo en los lados y textura arriba"
                  onChange={(event) => actualizar("notes", event.target.value)}
                />
              </div>
              <div className="privacy-note">
                <ShieldCheck size={17} />
                Tus datos se usan únicamente para gestionar esta cita.
              </div>
              <label className="remember-contact">
                <input
                  type="checkbox"
                  checked={recordarContacto}
                  onChange={(event) => onRecordarContacto(event.target.checked)}
                />
                Recordar mis datos en este dispositivo
              </label>
              <div className="wizard-actions">
                <button className="btn btn-linea" type="button" onClick={() => cambiarPaso(3)}>
                  <ArrowLeft size={18} />
                  Volver
                </button>
                <button className="btn btn-principal" type="submit">
                  <CircleCheckBig size={18} />
                  Confirmar cita
                </button>
              </div>
            </form>
          )}
        </div>

        <aside className="panel resumen-card reveal">
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
