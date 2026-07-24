import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheckBig,
  Clock3,
  Scissors,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { dinero, limpiarTelefono } from "../utils/format";

const pasos = [
  { id: 1, label: "Servicio" },
  { id: 2, label: "Fecha y hora" },
  { id: 3, label: "Tus datos" },
];

export default function BookingWizard({
  reserva,
  setReserva,
  resumen,
  servicios,
  extras,
  barbero,
  slots,
  cargandoSlots,
  minFecha,
  onFecha,
  onServicio,
  onExtra,
  onSubmit,
}) {
  const [paso, setPaso] = useState(1);

  useEffect(() => {
    if (!reserva.service_id && paso > 1) setPaso(1);
    if (reserva.start_min === null && paso > 2) setPaso(2);
  }, [paso, reserva.service_id, reserva.start_min]);

  const actualizar = (campo, valor) => {
    setReserva((actual) => ({
      ...actual,
      [campo]: campo === "client_phone" ? limpiarTelefono(valor) : valor,
    }));
  };

  const puedeAbrir = (numero) => {
    if (numero === 1) return true;
    if (numero === 2) return Boolean(reserva.service_id);
    return Boolean(reserva.service_id && reserva.start_min !== null);
  };

  return (
    <section id="reserva" className="seccion reserva-section">
      <div className="cabecera-seccion reveal">
        <div>
          <span className="eyebrow">Reserva online</span>
          <h2>Tu cita, lista en tres pasos.</h2>
          <p>La hora queda bloqueada cuando confirmas. Nadie mas podra tomar ese espacio.</p>
        </div>
      </div>

      <div className="reserva-grid">
        <div className="panel wizard-panel reveal">
          <nav className="wizard-steps" aria-label="Pasos de reserva">
            {pasos.map((item) => (
              <button
                className={`${paso === item.id ? "activo" : ""} ${paso > item.id ? "completo" : ""}`}
                key={item.id}
                type="button"
                disabled={!puedeAbrir(item.id)}
                onClick={() => setPaso(item.id)}
              >
                <span>{paso > item.id ? <Check size={15} /> : item.id}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {paso === 1 && (
            <div className="wizard-stage">
              <div className="stage-heading">
                <span>1 de 3</span>
                <h3>Que quieres hacerte?</h3>
                <p>Escoge el servicio principal. Puedes sumar extras sin alargar la cita.</p>
              </div>

              <div className="campo">
                <label htmlFor="booking-service">Servicio principal</label>
                <select
                  id="booking-service"
                  value={reserva.service_id}
                  onChange={(event) => onServicio(event.target.value)}
                >
                  {servicios.map((servicio) => (
                    <option key={servicio.id} value={servicio.id}>
                      {servicio.name} - {dinero(servicio.price)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="barber-choice">
                <span className="avatar-barber"><Scissors size={20} /></span>
                <div>
                  <small>Tu barbero</small>
                  <strong>{barbero?.name || "Sebastian"}</strong>
                  <span>{barbero?.role || "Master Barber"}</span>
                </div>
                <CircleCheckBig size={22} />
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

              <button className="btn btn-principal btn-ancho" type="button" onClick={() => setPaso(2)} disabled={!reserva.service_id}>
                Elegir fecha
                <ArrowRight size={18} />
              </button>
            </div>
          )}

          {paso === 2 && (
            <div className="wizard-stage">
              <div className="stage-heading">
                <span>2 de 3</span>
                <h3>Cuando te queda mejor?</h3>
                <p>Solo aparecen las horas que siguen libres en la agenda.</p>
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
                      onClick={() => setReserva((actual) => ({ ...actual, start_min: slot.start_min }))}
                    >
                      {slot.label}
                    </button>
                  ))}
                  {!cargandoSlots && slots.length === 0 && (
                    <div className="slots-vacio">No quedan espacios ese dia. Prueba con otra fecha.</div>
                  )}
                </div>
              </div>
              <div className="wizard-actions">
                <button className="btn btn-linea" type="button" onClick={() => setPaso(1)}>
                  <ArrowLeft size={18} />
                  Volver
                </button>
                <button className="btn btn-principal" type="button" onClick={() => setPaso(3)} disabled={reserva.start_min === null}>
                  Continuar
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {paso === 3 && (
            <form className="wizard-stage formulario" onSubmit={onSubmit}>
              <div className="stage-heading">
                <span>3 de 3</span>
                <h3>A nombre de quien?</h3>
                <p>Usaremos estos datos para identificar tu cita.</p>
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
                  placeholder="Ej: bajo en los lados, arriba con textura"
                  onChange={(event) => actualizar("notes", event.target.value)}
                />
              </div>
              <div className="privacy-note">
                <ShieldCheck size={17} />
                Tus datos se usan unicamente para gestionar esta cita.
              </div>
              <div className="wizard-actions">
                <button className="btn btn-linea" type="button" onClick={() => setPaso(2)}>
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
            <li><span>Barbero</span><strong>{barbero?.name || "Sebastian"}</strong></li>
            <li><span>Fecha</span><strong>{reserva.date}</strong></li>
            <li><span>Hora</span><strong>{resumen.hora || "Por elegir"}</strong></li>
            <li><span>Duracion</span><strong>{resumen.duracion || 0} min</strong></li>
          </ul>
          {resumen.extras.length > 0 && (
            <div className="resumen-extras">
              <span>Extras</span>
              <p>{resumen.extras.map((item) => item.name).join(", ")}</p>
            </div>
          )}
          <div className="resumen-total">
            <span>Total</span>
            <strong>{dinero(resumen.total)}</strong>
          </div>
          <p className="nota"><UserRound size={15} /> Llega unos minutos antes para empezar a tiempo.</p>
        </aside>
      </div>
    </section>
  );
}
