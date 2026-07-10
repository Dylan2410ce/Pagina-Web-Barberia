import { Clock, UserRound } from "lucide-react";
import { dinero, limpiarTelefono } from "../utils/format";

export default function BookingWizard({
  reserva,
  setReserva,
  resumen,
  slots,
  cargandoSlots,
  minFecha,
  onFecha,
  onSubmit,
}) {
  const actualizar = (campo, valor) => {
    setReserva((actual) => ({
      ...actual,
      [campo]: campo === "client_phone" ? limpiarTelefono(valor) : valor,
    }));
  };

  return (
    <section id="reserva" className="seccion reserva-grid">
      <div className="panel reveal">
        <div className="wizard-head">
          <span className="eyebrow">Reservar</span>
          <h2>Tu cita en pocos pasos.</h2>
          <p>Escoge servicio, mira las horas libres y deja tus datos. La agenda se confirma al instante.</p>
        </div>

        <div className="booking-helper">
          <article>
            <span>Servicio</span>
            <strong>{resumen.servicio?.name || "Pendiente"}</strong>
          </article>
          <article>
            <span>Fecha</span>
            <strong>{reserva.date}</strong>
          </article>
          <article>
            <span>Total</span>
            <strong>{dinero(resumen.total)}</strong>
          </article>
        </div>

        <div className="pasos">
          <span className={reserva.service_id ? "ok" : "activo"}>Servicio</span>
          <span className={reserva.start_min !== null ? "ok" : ""}>Hora</span>
          <span>Contacto</span>
        </div>

        <div className="campo">
          <label>Fecha</label>
          <input type="date" min={minFecha} value={reserva.date} onChange={(event) => onFecha(event.target.value)} />
        </div>

        <div className="campo">
          <label>Horas libres</label>
          <div className="slots">
            {cargandoSlots && <div className="slots-vacio"><span className="spinner" /> Buscando espacios...</div>}
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
            {!cargandoSlots && slots.length === 0 && <div className="slots-vacio">Ese día está lleno. Probá otra fecha.</div>}
          </div>
        </div>

        <form className="formulario" onSubmit={onSubmit}>
          <div className="campo">
            <label>Nombre</label>
            <input value={reserva.client_name} minLength={3} maxLength={80} required placeholder="Tu nombre completo" onChange={(event) => actualizar("client_name", event.target.value)} />
          </div>
          <div className="form-doble">
            <div className="campo">
              <label>WhatsApp</label>
              <input inputMode="numeric" pattern="[0-9]{8}" maxLength={8} value={reserva.client_phone} required placeholder="88887777" onChange={(event) => actualizar("client_phone", event.target.value)} />
            </div>
            <div className="campo">
              <label>Correo opcional</label>
              <input type="email" maxLength={160} value={reserva.client_email} placeholder="correo@ejemplo.com" onChange={(event) => actualizar("client_email", event.target.value)} />
            </div>
          </div>
          <div className="campo">
            <label>Notas</label>
            <input maxLength={240} value={reserva.notes} placeholder="Ej: bajo en los lados, arriba con textura" onChange={(event) => actualizar("notes", event.target.value)} />
          </div>
          <button className="btn btn-principal btn-ancho" type="submit" disabled={!resumen.servicio || reserva.start_min === null}>
            {!resumen.servicio || reserva.start_min === null ? "Escoge servicio y hora" : "Confirmar cita"}
          </button>
        </form>
      </div>

      <aside className="panel resumen-card reveal">
        <span className="chip"><Clock size={14} />Resumen</span>
        <h3>{resumen.servicio?.name || "Escoge un servicio"}</h3>
        <ul>
          <li><span>Fecha</span><strong>{reserva.date}</strong></li>
          <li><span>Hora</span><strong>{resumen.hora || "Pendiente"}</strong></li>
          <li><span>Duracion</span><strong>{resumen.duracion || 0} min</strong></li>
          <li><span>Total</span><strong>{dinero(resumen.total)}</strong></li>
        </ul>
        <p className="nota"><UserRound size={15} /> Te recomendamos llegar unos minutos antes para entrar tranquilo.</p>
      </aside>
    </section>
  );
}
