import React from "react";
import { CalendarDays, CalendarCheck, Clock3, MapPin, Navigation, Scissors, ShieldCheck, Sparkles } from "lucide-react";
import { money } from "../lib/api";

export function Hero({ data, onMap, onChooseService }) {
  const quickServices = data.services.slice(0, 3);

  return (
    <section className="hero section" data-reveal>
      <div className="hero-copy">
        <span className="eyebrow">Barberia Sebas / Esparza</span>
        <h1>
          <span>Cortes limpios.</span>
          <span>Agenda facil.</span>
          <span>Flow asegurado.</span>
        </h1>
        <p>
          Reserva en minutos, mira horarios reales y evita filas. La agenda se bloquea
          automaticamente para que nadie pueda tomar tu misma hora.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#reservar"><CalendarDays size={18} /> Agendar cita</a>
          <button type="button" className="btn btn-ghost" onClick={onMap}><Navigation size={18} /> Como llegar</button>
        </div>
      </div>

      <aside className="hero-command">
        <div className="command-head">
          <span><ShieldCheck size={18} /> Agenda protegida</span>
          <b>sin doble reserva</b>
        </div>
        <div className="command-grid">
          <article>
            <Clock3 size={20} />
            <strong>8:00 - 19:00</strong>
            <span>martes a sabado</span>
          </article>
          <article>
            <Scissors size={20} />
            <strong>{data.services.length}</strong>
            <span>servicios activos</span>
          </article>
          <article>
            <CalendarCheck size={20} />
            <strong>tiempo real</strong>
            <span>slots disponibles</span>
          </article>
          <article>
            <MapPin size={20} />
            <strong>Esparza</strong>
            <span>Barrio Maranonal</span>
          </article>
        </div>

        <div className="quick-services">
          <small><Sparkles size={14} /> Servicios rapidos</small>
          {quickServices.map((service) => (
            <button type="button" onClick={() => onChooseService(service.id)} key={service.id}>
              <span>{service.name}</span>
              <b>{money(service.price)}</b>
            </button>
          ))}
        </div>
      </aside>
    </section>
  );
}
