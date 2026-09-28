import { ArrowRight, MapPinned } from "lucide-react";

export default function Hero({
  barbero,
  primerSlot,
  estados = {},
  onMapa,
}) {
  const estadoActivo = barbero
    ? estados[barbero.id]
    : Object.values(estados).find((item) => item.is_open)
      || Object.values(estados)[0];
  const estadoTexto = estadoActivo?.message
    || (primerSlot ? `Próxima hora libre: ${primerSlot}` : "Reservas online abiertas");

  return (
    <section id="inicio" className="hero">
      <div className="hero-overlay" />
      <div className="hero-inner seccion">
        <div className="hero-copy">
          <p className="hero-kicker">Barbería en Esparza · Costa Rica</p>
          <h1>Sebas Barber</h1>
          <p className="hero-lead">
            Tu estilo. Sin complicaciones.
          </p>
          <p className="hero-description">Un buen corte empieza con un espacio para ti.</p>
          <div className="hero-acciones">
            <a className="btn btn-principal btn-grande" href="#reserva">
              Reservar cita <ArrowRight size={21} aria-hidden="true" />
            </a>
            <button className="btn btn-cristal" type="button" onClick={onMapa}>
              <MapPinned size={19} />
              Cómo llegar
            </button>
          </div>
          <span className={`hero-status ${estadoActivo?.is_open ? "is-open" : "is-closed"}`}><span />{estadoTexto}</span>
        </div>
      </div>
    </section>
  );
}
