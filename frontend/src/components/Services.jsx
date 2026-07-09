import React from "react";
import { CalendarCheck, Flame, Scissors, SlidersHorizontal, Sparkles, Star, Zap } from "lucide-react";
import { money } from "../lib/api";
import { serviceGroup, serviceMoods } from "../utils/business";

export function Services({ data, onChooseService }) {
  const [activeService, setActiveService] = React.useState(data.services[0]?.id || "");
  const [activeGroup, setActiveGroup] = React.useState("Todos");
  const groups = React.useMemo(() => ["Todos", ...Array.from(new Set(data.services.map(serviceGroup)))], [data.services]);
  const visibleServices = React.useMemo(
    () => activeGroup === "Todos" ? data.services : data.services.filter((item) => serviceGroup(item) === activeGroup),
    [activeGroup, data.services],
  );
  const service = data.services.find((item) => item.id === activeService) || visibleServices[0] || data.services[0];
  const minPrice = Math.min(...data.services.map((item) => item.price));
  const maxPrice = Math.max(...data.services.map((item) => item.price));

  React.useEffect(() => {
    if (visibleServices.some((item) => item.id === activeService)) return;
    setActiveService(visibleServices[0]?.id || data.services[0]?.id || "");
  }, [activeService, data.services, visibleServices]);

  return (
    <section id="servicios" className="section services-section" data-reveal>
      <div className="metrics">
        <article>
          <Flame size={20} />
          <strong>{data.services.length}</strong>
          <span>servicios</span>
        </article>
        <article>
          <CalendarCheck size={20} />
          <strong>8-7</strong>
          <span>martes a sabado</span>
        </article>
        <article>
          <Sparkles size={20} />
          <strong>{money(minPrice)}</strong>
          <span>desde</span>
        </article>
      </div>

      <div className="services-board">
        <div className="section-heading">
          <span className="eyebrow">Menu de barberia</span>
          <h2>Servicios claros, precio visible y reserva inmediata.</h2>
          <p>Filtra por estilo, compara duracion/precio y agenda el servicio sin perderte.</p>
        </div>

        <div className="service-filters" aria-label="Filtrar servicios">
          <span><SlidersHorizontal size={15} /> Filtrar</span>
          {groups.map((group) => (
            <button
              type="button"
              className={activeGroup === group ? "active" : ""}
              onClick={() => setActiveGroup(group)}
              key={group}
            >
              {group}
            </button>
          ))}
        </div>

        <div className="services-layout">
          <div className="service-cards">
            {visibleServices.map((item) => (
              <article
                className={item.id === service?.id ? "service-card active" : "service-card"}
                onMouseEnter={() => setActiveService(item.id)}
                onFocus={() => setActiveService(item.id)}
                key={item.id}
              >
                <button type="button" className="service-card-main" onClick={() => setActiveService(item.id)}>
                  <span>{serviceGroup(item)}</span>
                  <h3>{item.name}</h3>
                  <small>{item.duration_min} min / {item.duration_min > 60 ? "look completo" : "servicio express"}</small>
                </button>
                <div className="service-card-foot">
                  <strong>{money(item.price)}</strong>
                  <button type="button" className="btn btn-metal" onClick={() => onChooseService(item.id)}>
                    Elegir
                  </button>
                </div>
              </article>
            ))}
          </div>

          <aside className="service-preview">
            <span className="preview-icon"><Scissors size={22} /></span>
            <span className="eyebrow">Seleccionado</span>
            <h3>{service?.name}</h3>
            <p>{service?.duration_min} minutos / {money(service?.price)}</p>
            <div className="mood-row">
              {serviceMoods.map((mood) => <span key={mood}>{mood}</span>)}
            </div>
            <div className="service-energy">
              <Zap size={17} />
              <b>Ideal para</b>
              <span>{service?.duration_min > 60 ? "cambio de look o produccion" : "refresh semanal y salida casual"}</span>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => onChooseService(service?.id)}>
              Reservar este servicio
            </button>
          </aside>
        </div>

        {!!data.addons.length && (
          <div className="addon-row">
            <div>
              <span className="eyebrow">Extras</span>
              <h3>Detalles que elevan el corte.</h3>
            </div>
            <div className="addon-grid">
              {data.addons.map((addon) => (
                <article key={addon.id}>
                  <span>{addon.name}</span>
                  <small>{addon.duration_min} min</small>
                  <b>{money(addon.price)}</b>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="barbers">
        {data.barbers.map((barber) => (
          <article key={barber.id}>
            <span>{barber.name.slice(0, 1)}</span>
            <div>
              <h3>{barber.name}</h3>
              <p>{barber.role}</p>
              <small><Star size={14} /> Agenda activa</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
