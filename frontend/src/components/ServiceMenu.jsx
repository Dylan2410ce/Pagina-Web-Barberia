import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  Image,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { dinero } from "../utils/format";

const categorias = [
  { id: "todos", label: "Todos" },
  { id: "cortes", label: "Cortes" },
  { id: "barba", label: "Barba" },
  { id: "combos", label: "Combos" },
  { id: "tratamientos", label: "Tratamientos" },
];

function categoriaDe(nombre = "") {
  const texto = nombre.toLowerCase();
  if (texto.includes("combo") || (texto.includes("corte") && texto.includes("barba"))) {
    return "combos";
  }
  if (texto.includes("barba")) return "barba";
  if (
    texto.includes("color")
    || texto.includes("tinte")
    || texto.includes("mascarilla")
    || texto.includes("ceja")
  ) return "tratamientos";
  return "cortes";
}

function descripcionServicio(servicio) {
  const nombre = servicio.name.toLocaleLowerCase("es-CR");
  if (nombre.includes("mantenimiento de barba")) return "Contorno, largo y forma puestos al día.";
  if (nombre.includes("barba")) return "Perfilado completo con líneas bien definidas.";
  if (nombre.includes("ceja")) return "Limpieza sutil para equilibrar el rostro.";
  if (nombre.includes("mascarilla")) return "Limpieza facial para cerrar con un acabado fresco.";
  if (nombre.includes("color") || nombre.includes("rayito")) return "Diagnóstico de tono y trabajo técnico personalizado.";
  if (nombre.includes("tinte")) return "Color uniforme con preparación y acabado profesional.";
  return "Corte a tu medida, con terminaciones limpias.";
}

export default function ServiceMenu({
  servicios,
  extras,
  reserva,
  onServicio,
  onExtra,
  onContinuar,
}) {
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
          <h2>El menú, claro desde el inicio.</h2>
          <p>Escoge el servicio principal y suma solo los extras que quieras.</p>
        </div>
        <button className="btn btn-linea" type="button" onClick={() => setMostrarPoster(true)}>
          <Image size={18} />
          Ver menú impreso
        </button>
      </div>

      <div className="filtros-servicios reveal" role="tablist" aria-label="Categorías de servicios">
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
        {visibles.length === 0 && (
          <div className="menu-empty">
            <strong>Aún no hay servicios en esta categoría.</strong>
            <button className="btn btn-linea" type="button" onClick={() => setCategoria("todos")}>
              Ver todos
            </button>
          </div>
        )}
        {visibles.map((servicio) => {
          const activo = reserva.service_id === servicio.id;
          return (
            <article
              className={`servicio-card ${activo ? "activo" : ""}`}
              key={servicio.id}
              data-selected={activo || undefined}
            >
              <div className="servicio-top">
                <span className="servicio-icono">
                  {activo ? <Check size={18} /> : <Sparkles size={18} />}
                </span>
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
                onClick={() => (activo ? onContinuar?.() : onServicio(servicio.id))}
              >
                {activo ? <ArrowRight size={17} /> : <Plus size={17} />}
                {activo ? "Continuar reserva" : "Elegir servicio"}
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
          <section className="modal modal-poster" role="dialog" aria-modal="true" aria-label="Menú oficial" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <strong>Menú oficial de precios</strong>
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
