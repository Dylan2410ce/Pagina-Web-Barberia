import { ArrowRight, CheckCircle2, Clock3, Sparkles } from "lucide-react";

const trabajos = [
  {
    src: "/corte-fade.jpg",
    alt: "Corte texturizado con fade limpio",
    titulo: "Textura y fade",
    detalle: "Transicion suave y acabado natural.",
  },
  {
    src: "/barba-perfilada.jpg",
    alt: "Barba perfilada con contornos definidos",
    titulo: "Barba definida",
    detalle: "Lineas precisas y volumen equilibrado.",
  },
  {
    src: "/barberia-hero.jpg",
    alt: "Sebas trabajando un corte en la barberia",
    titulo: "Detalle en cada corte",
    detalle: "Tiempo bien usado, sin trabajar a la carrera.",
  },
];

export default function Gallery() {
  return (
    <section id="trabajos" className="seccion bloque">
      <div className="cabecera-seccion reveal">
        <div>
          <span className="eyebrow">El trabajo</span>
          <h2>Un buen corte se nota de cerca.</h2>
          <p>Acabados limpios, proporciones cuidadas y un estilo que funciona fuera de la silla.</p>
        </div>
        <a className="btn btn-linea" href="#reserva">Reservar <ArrowRight size={17} /></a>
      </div>

      <div className="galeria-grid reveal">
        {trabajos.map((trabajo, index) => (
          <figure className={`galeria-item galeria-item-${index + 1}`} key={trabajo.src}>
            <img src={trabajo.src} alt={trabajo.alt} loading="lazy" />
            <figcaption>
              <strong>{trabajo.titulo}</strong>
              <span>{trabajo.detalle}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="service-promises reveal">
        <article><CheckCircle2 size={20} /><div><strong>Precio antes de confirmar</strong><span>Sin sorpresas al terminar.</span></div></article>
        <article><Clock3 size={20} /><div><strong>Tu hora queda apartada</strong><span>La agenda evita reservas dobles.</span></div></article>
        <article><Sparkles size={20} /><div><strong>Atencion uno a uno</strong><span>Tu corte lleva su propio tiempo.</span></div></article>
      </div>
    </section>
  );
}
