import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Sparkles,
  X,
  ZoomIn,
} from "lucide-react";

const estilos = [
  {
    src: "/corte-fade.jpg",
    alt: "Corte texturizado con degradado limpio",
    nombre: "Textura y fade",
    categoria: "Degradado",
    detalle: "Transición suave, laterales limpios y movimiento arriba.",
    ideal: "Cabello lacio u ondulado",
    mantenimiento: "Cada 2 o 3 semanas",
  },
  {
    src: "/barba-perfilada.jpg",
    alt: "Barba perfilada con contornos definidos",
    nombre: "Barba definida",
    categoria: "Barba",
    detalle: "Contorno preciso y volumen equilibrado para marcar el rostro.",
    ideal: "Barba media o completa",
    mantenimiento: "Cada 2 semanas",
  },
  {
    src: "/barberia-hero.jpg",
    alt: "Corte clásico trabajado en Sebas Barber",
    nombre: "Clásico limpio",
    categoria: "Clásico",
    detalle: "Forma natural, acabado pulido y fácil de mantener en casa.",
    ideal: "Cualquier tipo de cabello",
    mantenimiento: "Cada 3 o 4 semanas",
  },
];

export default function Gallery({ onElegirEstilo }) {
  const [indice, setIndice] = useState(0);
  const [ampliado, setAmpliado] = useState(false);
  const estilo = estilos[indice];

  useEffect(() => {
    if (!ampliado) return undefined;
    const cerrarConEscape = (event) => {
      if (event.key === "Escape") setAmpliado(false);
    };
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [ampliado]);

  const mover = (direccion) => {
    setIndice((actual) => (actual + direccion + estilos.length) % estilos.length);
  };

  const elegir = () => {
    onElegirEstilo?.(estilo);
    setAmpliado(false);
  };

  return (
    <section id="trabajos" className="seccion bloque lookbook-section">
      <div className="cabecera-seccion reveal">
        <div>
          <span className="eyebrow">Lookbook</span>
          <h2>Encuentra el corte que va contigo.</h2>
          <p>Explora algunos acabados y guarda una referencia para tu próxima cita.</p>
        </div>
        <div className="lookbook-nav" aria-label="Cambiar estilo">
          <button className="icon-btn" type="button" onClick={() => mover(-1)} aria-label="Estilo anterior">
            <ArrowLeft size={18} />
          </button>
          <button className="icon-btn" type="button" onClick={() => mover(1)} aria-label="Siguiente estilo">
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <div className="lookbook-main reveal" aria-live="polite">
        <button className="lookbook-photo" type="button" onClick={() => setAmpliado(true)} aria-label={`Ampliar ${estilo.nombre}`}>
          <img src={estilo.src} alt={estilo.alt} loading="lazy" />
          <span><ZoomIn size={18} />Ver detalle</span>
        </button>
        <div className="lookbook-copy">
          <span className="lookbook-count">0{indice + 1} / 0{estilos.length}</span>
          <span className="chip">{estilo.categoria}</span>
          <h3>{estilo.nombre}</h3>
          <p>{estilo.detalle}</p>
          <dl>
            <div><dt>Funciona bien en</dt><dd>{estilo.ideal}</dd></div>
            <div><dt>Retoque recomendado</dt><dd>{estilo.mantenimiento}</dd></div>
          </dl>
          <button className="btn btn-principal" type="button" onClick={elegir}>
            <CalendarPlus size={18} />
            Quiero este estilo
          </button>
        </div>
      </div>

      <div className="lookbook-thumbs reveal" role="tablist" aria-label="Estilos disponibles">
        {estilos.map((item, itemIndex) => (
          <button
            className={itemIndex === indice ? "activo" : ""}
            key={item.nombre}
            type="button"
            role="tab"
            aria-selected={itemIndex === indice}
            onClick={() => setIndice(itemIndex)}
          >
            <img src={item.src} alt="" loading="lazy" />
            <span><strong>{item.nombre}</strong><small>{item.categoria}</small></span>
          </button>
        ))}
      </div>

      <div className="service-promises reveal">
        <article><CheckCircle2 size={20} /><div><strong>Precio claro</strong><span>Sabes el total antes de confirmar.</span></div></article>
        <article><Clock3 size={20} /><div><strong>Tu espacio es tuyo</strong><span>La agenda evita cruces de horario.</span></div></article>
        <article><Sparkles size={20} /><div><strong>Atención uno a uno</strong><span>Cada corte recibe el tiempo que necesita.</span></div></article>
      </div>

      {ampliado && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setAmpliado(false)}>
          <section
            className="modal lookbook-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lookbook-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="icon-btn lookbook-modal-close" type="button" onClick={() => setAmpliado(false)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <img src={estilo.src} alt={estilo.alt} />
            <div>
              <span className="chip">{estilo.categoria}</span>
              <h2 id="lookbook-modal-title">{estilo.nombre}</h2>
              <p>{estilo.detalle}</p>
              <button className="btn btn-principal" type="button" onClick={elegir}>
                <CalendarPlus size={18} />
                Reservar con esta referencia
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
