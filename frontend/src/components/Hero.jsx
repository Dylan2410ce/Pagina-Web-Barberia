import { CalendarCheck, MapPinned, Sparkles } from "lucide-react";

export default function Hero({ barbero, servicios, primerSlot, onMapa }) {
  return (
    <section id="inicio" className="hero seccion">
      <div className="hero-copy reveal">
        <span className="eyebrow">Cortes de Sebastian</span>
        <h1>Tu corte fresco, sin esperar de más.</h1>
        <p>
          Un espacio cómodo, puntual y con estilo propio. Escogé el servicio, reservá tu hora y llegá directo a la silla.
        </p>
        <div className="hero-acciones">
          <a className="btn btn-principal" href="#reserva"><CalendarCheck size={18} />Reservar ahora</a>
          <button className="btn btn-secundario" type="button" onClick={onMapa}><MapPinned size={18} />Ver ubicación</button>
        </div>
      </div>

      <aside className="hero-panel reveal">
        <div className="tarjeta-destacada hero-signature">
          <span className="chip"><Sparkles size={14} />Sebastian</span>
          <h2>{barbero?.role || "Master Barber"}</h2>
          <p>Cortes limpios, fades bien trabajados y una agenda pensada para que tu tiempo se respete.</p>
        </div>
        <div className="metricas">
          <article><strong>{servicios.length}</strong><span>Servicios disponibles</span></article>
          <article><strong>{primerSlot || "Hoy"}</strong><span>Espacios por revisar</span></article>
          <article><strong>5 min</strong><span>Respiro entre citas</span></article>
        </div>
      </aside>
    </section>
  );
}
