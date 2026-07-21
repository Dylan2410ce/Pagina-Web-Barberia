import { Check, Plus } from "lucide-react";
import { dinero } from "../utils/format";

export default function ServiceMenu({ servicios, extras, reserva, onServicio, onExtra }) {
  return (
    <section id="servicios" className="seccion bloque">
      <div className="cabecera-seccion reveal">
        <span className="eyebrow">Menu oficial</span>
        <h2>Precios claros antes de reservar.</h2>
        <p>Elige un servicio principal y, si quieres, agrega un extra. Todo se calcula antes de confirmar.</p>
      </div>

      <div className="menu-layout reveal">
        <aside className="menu-poster">
          <img src="/menu-oficial.jpeg" alt="Lista oficial de precios de Sebas Barber" />
        </aside>

        <div className="menu-selector">
          <div className="selector-head">
            <div>
              <h3>Servicios para reservar</h3>
              <p>Los cortes regulares duran 45 minutos. Colorimetria y tinte ocupan mas tiempo.</p>
            </div>
            <a className="btn btn-linea" href="#reserva">Ir a reservar</a>
          </div>
          <div className="menu-grid">
            {servicios.map((servicio) => (
              <article className={`servicio-card ${reserva.service_id === servicio.id ? "activo" : ""}`} key={servicio.id}>
                <div>
                  <span>Servicio</span>
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

          {extras.length > 0 && (
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
          )}
        </div>
      </div>
    </section>
  );
}
