import { useEffect, useMemo, useState } from "react";
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
import useDialogA11y from "../hooks/useDialogA11y";

const fallback = [
  {
    id: "fade",
    image_url: "/corte-fade.jpg",
    alt_text: "Corte texturizado con degradado limpio",
    title: "Textura y fade",
    category: "Degradado",
    description: "Transición suave, laterales limpios y movimiento arriba.",
    barber_name: "Sebastián",
  },
  {
    id: "barba",
    image_url: "/barba-perfilada.jpg",
    alt_text: "Barba perfilada con contornos definidos",
    title: "Barba definida",
    category: "Barba",
    description: "Contorno preciso y volumen equilibrado para marcar el rostro.",
    barber_name: "Sebastián",
  },
  {
    id: "clasico",
    image_url: "/barberia-hero.jpg",
    alt_text: "Corte clásico trabajado en Sebas Barber",
    title: "Clásico limpio",
    category: "Clásico",
    description: "Forma natural, acabado pulido y fácil de mantener.",
    barber_name: "Sebastián",
  },
];

export default function Gallery({ items = [], onElegirEstilo }) {
  const estilos = useMemo(() => (items.length ? items : fallback), [items]);
  const [indice, setIndice] = useState(0);
  const [ampliado, setAmpliado] = useState(false);
  const estilo = estilos[Math.min(indice, estilos.length - 1)] || fallback[0];
  const modalRef = useDialogA11y(ampliado ? () => setAmpliado(false) : null);

  useEffect(() => {
    if (indice >= estilos.length) setIndice(0);
  }, [estilos.length, indice]);

  const mover = (direccion) => {
    setIndice((actual) => (actual + direccion + estilos.length) % estilos.length);
  };

  const elegir = () => {
    onElegirEstilo?.({
      nombre: estilo.title,
      barber_id: estilo.barber_id,
    });
    setAmpliado(false);
  };

  return (
    <section id="trabajos" className="seccion bloque lookbook-section">
      <div className="cabecera-seccion reveal">
        <div>
          <span className="eyebrow">Cortes recientes</span>
          <h2>Una referencia para tu próximo look.</h2>
          <p>Explora acabados reales y guarda el que más se parece a lo que buscas.</p>
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
        <button
          className="lookbook-photo"
          type="button"
          onClick={() => setAmpliado(true)}
          aria-label={`Ampliar ${estilo.title}`}
        >
          <img src={estilo.image_url} alt={estilo.alt_text} loading="lazy" />
          <span><ZoomIn size={18} />Ver detalle</span>
        </button>
        <div className="lookbook-copy">
          <span className="lookbook-count">
            {String(indice + 1).padStart(2, "0")}
            {" / "}
            {String(estilos.length).padStart(2, "0")}
          </span>
          <span className="chip">{estilo.category}</span>
          <h3>{estilo.title}</h3>
          <p>{estilo.description}</p>
          <dl>
            <div><dt>Trabajo de</dt><dd>{estilo.barber_name || "Sebas Barber"}</dd></div>
            <div><dt>Referencia</dt><dd>La añadimos a las notas de tu cita</dd></div>
          </dl>
          <button className="btn btn-principal" type="button" onClick={elegir}>
            <CalendarPlus size={18} />
            Reservar este estilo
          </button>
        </div>
      </div>

      <div className="lookbook-thumbs reveal" role="tablist" aria-label="Estilos disponibles">
        {estilos.map((item, itemIndex) => (
          <button
            className={itemIndex === indice ? "activo" : ""}
            key={item.id || item.title}
            type="button"
            role="tab"
            aria-selected={itemIndex === indice}
            onClick={() => setIndice(itemIndex)}
          >
            <img src={item.image_url} alt="" loading="lazy" />
            <span><strong>{item.title}</strong><small>{item.category}</small></span>
          </button>
        ))}
      </div>

      <div className="service-promises reveal">
        <article><CheckCircle2 size={20} /><div><strong>Precio claro</strong><span>Conoces el total antes de confirmar.</span></div></article>
        <article><Clock3 size={20} /><div><strong>Horario protegido</strong><span>Una sola reserva por espacio.</span></div></article>
        <article><Sparkles size={20} /><div><strong>Atención personal</strong><span>Tu corte recibe su tiempo completo.</span></div></article>
      </div>

      {ampliado && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setAmpliado(false)}>
          <section
            ref={modalRef}
            className="modal lookbook-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lookbook-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="icon-btn lookbook-modal-close" type="button" onClick={() => setAmpliado(false)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <img src={estilo.image_url} alt={estilo.alt_text} />
            <div>
              <span className="chip">{estilo.category}</span>
              <h2 id="lookbook-modal-title">{estilo.title}</h2>
              <p>{estilo.description}</p>
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
