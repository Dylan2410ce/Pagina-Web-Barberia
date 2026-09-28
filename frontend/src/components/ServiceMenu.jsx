import { useMemo, useState } from "react";
import { ArrowRight, Clock3, Image, Sparkles } from "lucide-react";
import { dinero } from "../utils/format";
import Dialog from "./ui/Dialog";

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
  onSeleccionar,
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
          <span className="eyebrow">El menú</span>
          <h2>Un corte. Muy tú.</h2>
          <p>Elige tu servicio. Nosotros cuidamos los detalles.</p>
        </div>
        <button className="btn btn-linea" type="button" onClick={() => setMostrarPoster(true)}>
          <Image size={18} />
          Ver menú impreso
        </button>
      </div>

      <div className="filtros-servicios reveal" role="tablist" aria-label="Categorías de servicios">
        {categorias.filter((item) => item.id === "todos" || servicios.some((servicio) => categoriaDe(servicio.name) === item.id)).map((item) => (
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
        {visibles.map((servicio) => (
          <article className="servicio-card" key={servicio.id}>
            <span className="service-category">{categorias.find((item) => item.id === categoriaDe(servicio.name))?.label}</span>
            <div>
              <h3>{servicio.name}</h3>
              <p>{descripcionServicio(servicio)}</p>
            </div>
            <span className="servicio-precio">{dinero(servicio.price)}</span>
            <span className="servicio-tiempo">
              <Clock3 size={15} />
              {servicio.duration_min} min aprox.
            </span>
            <button className="btn btn-principal" type="button" onClick={() => onSeleccionar?.(servicio.id)} aria-label={`Reservar ${servicio.name}`}>Elegir servicio <ArrowRight size={17} aria-hidden="true" /></button>
          </article>
        ))}
      </div>

      {extras.length > 0 && (
        <div className="extras-strip reveal">
          <div>
            <span className="eyebrow">Extras</span>
            <h3>Completa tu cita</h3>
            <p>Se suman al precio, no al tiempo reservado.</p>
          </div>
          <div className="extras-grid">
            {extras.map((extra) => (
              <article className="extra-option extra-option-static" key={extra.id}>
                <span><Sparkles size={16} /></span>
                <div>
                  <strong>{extra.name}</strong>
                  <small>{dinero(extra.price)}</small>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {mostrarPoster && (
        <Dialog title="Menú oficial de precios" onClose={() => setMostrarPoster(false)}>
            <img src="/menu-oficial.jpeg" alt="Lista oficial de precios de Sebas Barber" />
        </Dialog>
      )}
    </section>
  );
}
