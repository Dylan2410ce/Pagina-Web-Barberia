import { CalendarCheck, Clock3, MapPinned, Scissors } from "lucide-react";

export default function Hero({ barbero, primerSlot, onMapa }) {
  return (
    <section id="inicio" className="hero">
      <div className="hero-overlay" />
      <div className="hero-inner seccion">
        <div className="hero-copy reveal">
          <span className="hero-status">
            <span />
            {primerSlot ? `Proxima hora libre: ${primerSlot}` : "Agenda online disponible"}
          </span>
          <p className="hero-kicker">Barberia en Esparza</p>
          <h1>Sebas Barber</h1>
          <p className="hero-lead">
            Cortes limpios, barba precisa y una cita que reservas desde el celular en menos de un minuto.
          </p>
          <div className="hero-acciones">
            <a className="btn btn-principal btn-grande" href="#reserva">
              <CalendarCheck size={19} />
              Reservar cita online
            </a>
            <button className="btn btn-cristal" type="button" onClick={onMapa}>
              <MapPinned size={19} />
              Como llegar
            </button>
          </div>
          <div className="hero-facts" aria-label="Informacion de la barberia">
            <span><Scissors size={16} />{barbero?.name || "Sebastian"}</span>
            <span><Clock3 size={16} />Citas desde las 8:00 a. m.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
