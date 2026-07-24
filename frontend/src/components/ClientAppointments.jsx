import { CalendarClock, Search, Trash2 } from "lucide-react";
import { claseEstado, dinero, fechaHumana, limpiarTelefono, textoEstado } from "../utils/format";

export default function ClientAppointments({ telefono, setTelefono, citas, onBuscar, onCancelar, onReprogramar }) {
  return (
    <section id="mis-citas" className="seccion bloque client-area">
      <div className="cabecera-seccion reveal">
        <div>
          <span className="eyebrow">Mis citas</span>
          <h2>Consulta, cambia o cancela.</h2>
          <p>Usa el mismo numero de WhatsApp con el que reservaste.</p>
        </div>
      </div>
      <div className="client-search-layout reveal">
        <form className="client-search" onSubmit={onBuscar}>
          <label htmlFor="lookup-phone">Numero de WhatsApp</label>
          <div>
            <input
              id="lookup-phone"
              inputMode="numeric"
              pattern="[24678][0-9]{7}"
              maxLength={8}
              value={telefono}
              placeholder="88887777"
              onChange={(event) => setTelefono(limpiarTelefono(event.target.value))}
              required
            />
            <button className="btn btn-principal" type="submit"><Search size={17} />Buscar citas</button>
          </div>
          <small>No necesitas crear una cuenta.</small>
        </form>

        <div className="lista-citas">
          {citas.length === 0 && (
            <div className="empty-appointments">
              <CalendarClock size={26} />
              <strong>Tus reservas apareceran aqui</strong>
              <span>Escribe tu numero y toca Buscar citas.</span>
            </div>
          )}
          {citas.map((cita) => (
            <article className="cita-card" key={cita.id}>
              <div>
                <span className={claseEstado(cita.status)}>{textoEstado(cita.status)}</span>
                <h3>{cita.service_name}</h3>
                <p>{fechaHumana(cita.starts_at)} · {dinero(cita.total_price)}</p>
              </div>
              {cita.status === "booked" ? (
                <div className="acciones-card">
                  <button className="btn btn-linea" type="button" onClick={() => onReprogramar(cita)}>
                    <CalendarClock size={16} />
                    Reprogramar
                  </button>
                  <button className="btn btn-peligro" type="button" onClick={() => onCancelar(cita.id)}>
                    <Trash2 size={16} />
                    Cancelar
                  </button>
                </div>
              ) : <span className="nota">Esta cita ya no admite cambios.</span>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
