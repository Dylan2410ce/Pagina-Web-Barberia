import { CalendarCheck, MapPinned, Sparkles } from "lucide-react";

export default function Hero({ barbero, servicios, primerSlot, onMapa }) {
  return (
    <section id="inicio" className="hero seccion">
      <div className="hero-copy reveal">
        <span className="eyebrow">Solo con Sebastian</span>
        <h1>Corte limpio, agenda clara y estilo sin complicarse.</h1>
        <p>
          Reserva tu espacio en segundos, mira las horas reales disponibles y llega directo a la silla.
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
          <p>Fades pulidos, cortes limpios y una atencion tranquila para que cada detalle quede en su lugar.</p>
        </div>
        <div className="metricas">
          <article><strong>{servicios.length}</strong><span>Servicios disponibles</span></article>
          <article><strong>{primerSlot || "Hoy"}</strong><span>Primera hora libre</span></article>
          <article><strong>45 min</strong><span>Corte regular</span></article>
        </div>
      </aside>
    </section>
  );
}
