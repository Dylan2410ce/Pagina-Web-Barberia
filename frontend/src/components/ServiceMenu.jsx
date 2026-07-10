import { Check, Plus } from "lucide-react";
import { dinero } from "../utils/format";

export default function ServiceMenu({ servicios, extras, reserva, onServicio, onExtra }) {
  return (
    <section id="servicios" className="seccion bloque">
      <div className="cabecera-seccion reveal">
        <span className="eyebrow">Carta de precios</span>
        <h2>Escoge tu corte y suma solo lo que ocupas.</h2>
        <p>Primero el servicio principal. Despues, si quieres, agrega extras que solo cambian el total.</p>
      </div>

      <div className="menu-layout reveal">
        <div>
          <h3>Cortes principales</h3>
          <div className="menu-grid">
            {servicios.map((servicio) => (
              <article className={`servicio-card ${reserva.service_id === servicio.id ? "activo" : ""}`} key={servicio.id}>
                <div>
                  <span>Corte principal</span>
                  <h4>{servicio.name}</h4>
                  <p>{servicio.duration_min} min aprox.</p>
                </div>
                <strong>{dinero(servicio.price)}</strong>
                <button className={`btn ${reserva.service_id === servicio.id ? "btn-principal" : "btn-linea"}`} type="button" aria-pressed={reserva.service_id === servicio.id} onClick={() => onServicio(servicio.id)}>
                  {reserva.service_id === servicio.id ? <Check size={17} /> : <Plus size={17} />}
                  {reserva.service_id === servicio.id ? "Seleccionado" : "Elegir este"}
                </button>
              </article>
            ))}
          </div>
        </div>

        <aside className="extras-panel">
          <h3>Extras</h3>
          <div className="extras-grid">
            {extras.map((extra) => {
              const activo = reserva.addon_ids.includes(extra.id);
              return (
                <article className={`servicio-card extra ${activo ? "activo" : ""}`} key={extra.id}>
                  <div>
                    <span>Extra</span>
                    <h4>{extra.name}</h4>
                    <p>Se suma al total, no al tiempo</p>
                  </div>
                  <strong>{dinero(extra.price)}</strong>
                  <button className={`btn ${activo ? "btn-principal" : "btn-linea"}`} type="button" aria-pressed={activo} onClick={() => onExtra(extra.id)}>
                    {activo ? <Check size={17} /> : <Plus size={17} />}
                    {activo ? "Agregado" : "Sumar extra"}
                  </button>
                </article>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}
