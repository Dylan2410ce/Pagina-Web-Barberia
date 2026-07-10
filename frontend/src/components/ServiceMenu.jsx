import { Check, Plus } from "lucide-react";
import { dinero } from "../utils/format";

export default function ServiceMenu({ servicios, extras, reserva, onServicio, onExtra }) {
  return (
    <section id="servicios" className="seccion bloque">
      <div className="cabecera-seccion reveal">
        <span className="eyebrow">Menú de precios</span>
        <h2>Elegí el look. Nosotros cuidamos el detalle.</h2>
        <p>Servicios claros, duración realista y extras para salir más pulido.</p>
      </div>

      <div className="menu-layout reveal">
        <div>
          <h3>Cortes principales</h3>
          <div className="menu-grid">
            {servicios.map((servicio) => (
              <article className={`servicio-card ${reserva.service_id === servicio.id ? "activo" : ""}`} key={servicio.id}>
                <div>
                  <span>Servicio</span>
                  <h4>{servicio.name}</h4>
                  <p>{servicio.duration_min} min</p>
                </div>
                <strong>{dinero(servicio.price)}</strong>
                <button className={`btn ${reserva.service_id === servicio.id ? "btn-principal" : "btn-linea"}`} type="button" onClick={() => onServicio(servicio.id)}>
                  {reserva.service_id === servicio.id ? <Check size={17} /> : <Plus size={17} />}
                  {reserva.service_id === servicio.id ? "Elegido" : "Elegir"}
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
                    <span>Complemento</span>
                    <h4>{extra.name}</h4>
                    <p>{extra.duration_min} min</p>
                  </div>
                  <strong>{dinero(extra.price)}</strong>
                  <button className={`btn ${activo ? "btn-principal" : "btn-linea"}`} type="button" onClick={() => onExtra(extra.id)}>
                    {activo ? <Check size={17} /> : <Plus size={17} />}
                    {activo ? "Agregado" : "Agregar"}
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
