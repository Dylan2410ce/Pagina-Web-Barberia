import { CalendarClock, Search } from "lucide-react";
import { claseEstado, dinero, fechaHumana, limpiarTelefono, textoEstado } from "../utils/format";

export default function ClientAppointments({ telefono, setTelefono, citas, onBuscar, onCancelar, onReprogramar }) {
  return (
    <section id="mis-citas" className="seccion bloque">
      <div className="cabecera-seccion reveal">
        <span className="eyebrow">Mis citas</span>
        <h2>Consulta o mueve tu cita.</h2>
        <p>Ingresa tu WhatsApp para ver tus reservas activas, cancelar o cambiar la hora.</p>
      </div>
      <div className="panel reveal">
        <form className="busqueda-linea" onSubmit={onBuscar}>
          <input
            inputMode="numeric"
            maxLength={8}
            value={telefono}
            placeholder="Telefono de 8 digitos"
            onChange={(event) => setTelefono(limpiarTelefono(event.target.value))}
            required
          />
          <button className="btn btn-principal" type="submit"><Search size={17} />Buscar</button>
        </form>

        <div className="lista-citas">
          {citas.length === 0 && <div className="vacio">Tus citas apareceran aqui despues de buscar tu numero.</div>}
          {citas.map((cita) => (
            <article className="cita-card" key={cita.id}>
              <div>
                <span className={claseEstado(cita.status)}>{textoEstado(cita.status)}</span>
                <h4>{cita.service_name}</h4>
                <p>{fechaHumana(cita.starts_at)} · {dinero(cita.total_price)}</p>
              </div>
              {cita.status === "booked" ? (
                <div className="acciones-card">
                  <button className="btn btn-linea" type="button" onClick={() => onReprogramar(cita)}><CalendarClock size={16} />Reprogramar</button>
                  <button className="btn btn-peligro" type="button" onClick={() => onCancelar(cita.id)}>Cancelar</button>
                </div>
              ) : <span className="nota">Sin acciones disponibles</span>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
