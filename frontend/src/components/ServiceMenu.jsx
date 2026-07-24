import { useMemo, useState } from "react";
import { Check, Clock3, Image, Plus, Sparkles, X } from "lucide-react";
import { dinero } from "../utils/format";

const categorias = [
  { id: "todos", label: "Todos" },
  { id: "cortes", label: "Cortes" },
  { id: "barba", label: "Barba" },
  { id: "tratamientos", label: "Tratamientos" },
];

function categoriaDe(nombre = "") {
  const texto = nombre.toLowerCase();
  if (texto.includes("barba")) return "barba";
  if (texto.includes("color") || texto.includes("tinte") || texto.includes("mascarilla")) return "tratamientos";
  return "cortes";
}

function descripcionServicio(servicio) {
  const categoria = categoriaDe(servicio.name);
  if (categoria === "barba") return "Contorno limpio y acabado definido.";
  if (categoria === "tratamientos") return "Trabajo especializado con tiempo reservado.";
  return "Corte personalizado con acabado prolijo.";
}

export default function ServiceMenu({ servicios, extras, reserva, onServicio, onExtra }) {
  const [categoria, setCategoria] = useState("todos");
  const [mostrarPoster, setMostrarPoster] = useState(false);
  const visibles = useMemo(
    () => servicios.filter((servicio) => categoria === "todos" || categoriaDe(servicio.name) === categoria),
    [categoria, servicios],
  );

  return (
    <section id="servicios" className="seccion bloque">
      <div className="cabecera-seccion reveal">
        <div>
          <span className="eyebrow">Servicios y precios</span>
          <h2>Elige el estilo. El precio ya esta claro.</h2>
        </div>
        <button className="btn btn-linea" type="button" onClick={() => setMostrarPoster(true)}>
          <Image size={18} />
          Ver menu impreso
        </button>
      </div>

      <div className="filtros-servicios reveal" role="tablist" aria-label="Categorias de servicios">
        {categorias.map((item) => (
          <button
            className={categoria === item.id ? "activo" : ""}
            key={item.id}
            type="button"
            role="tab"
            aria-selected={categoria === item.id}
            onClick={() => setCategoria(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="menu-grid reveal">
        {visibles.map((servicio) => {
          const activo = reserva.service_id === servicio.id;
          return (
            <article className={`servicio-card ${activo ? "activo" : ""}`} key={servicio.id}>
              <div className="servicio-top">
                <span className="servicio-icono"><Sparkles size={18} /></span>
                <span className="servicio-precio">{dinero(servicio.price)}</span>
              </div>
              <div>
                <h3>{servicio.name}</h3>
                <p>{descripcionServicio(servicio)}</p>
              </div>
              <span className="servicio-tiempo">
                <Clock3 size={15} />
                {servicio.duration_min} min aprox.
              </span>
              <button
                className={`btn ${activo ? "btn-principal" : "btn-linea"}`}
                type="button"
                aria-pressed={activo}
                onClick={() => onServicio(servicio.id)}
              >
                {activo ? <Check size={17} /> : <Plus size={17} />}
                {activo ? "Elegido" : "Elegir servicio"}
              </button>
            </article>
          );
        })}
      </div>

      {extras.length > 0 && (
        <div className="extras-strip reveal">
          <div>
            <span className="eyebrow">Extras</span>
            <h3>Completa tu cita</h3>
            <p>Se suman al precio, no al tiempo reservado.</p>
          </div>
          <div className="extras-grid">
            {extras.map((extra) => {
              const activo = reserva.addon_ids.includes(extra.id);
              return (
                <button
                  className={`extra-option ${activo ? "activo" : ""}`}
                  key={extra.id}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => onExtra(extra.id)}
                >
                  <span>{activo ? <Check size={17} /> : <Plus size={17} />}</span>
                  <div>
                    <strong>{extra.name}</strong>
                    <small>{dinero(extra.price)}</small>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mostrarPoster && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setMostrarPoster(false)}>
          <section className="modal modal-poster" role="dialog" aria-modal="true" aria-label="Menu oficial" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <strong>Menu oficial de precios</strong>
              <button className="icon-btn" type="button" onClick={() => setMostrarPoster(false)} aria-label="Cerrar">
                <X size={19} />
              </button>
            </header>
            <img src="/menu-oficial.jpeg" alt="Lista oficial de precios de Sebas Barber" />
          </section>
        </div>
      )}
    </section>
  );
}
