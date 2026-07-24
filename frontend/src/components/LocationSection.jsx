import { Clock3, MapPinned, MessageCircle, Navigation } from "lucide-react";
import { diasSemana, minutosAHora } from "../utils/format";

function horaCorta(minutos) {
  const [hora, minuto] = minutosAHora(minutos).split(":");
  const numero = Number(hora);
  const sufijo = numero >= 12 ? "p. m." : "a. m.";
  const visible = numero % 12 || 12;
  return `${visible}:${minuto} ${sufijo}`;
}

export default function LocationSection({ location, horarios = [], barbero, onMapa }) {
  const telefono = String(barbero?.phone || "").replace(/\D/g, "");
  const whatsappUrl = telefono && telefono !== "88887777" ? `https://wa.me/506${telefono}` : "";

  return (
    <section id="ubicacion" className="location-band">
      <div className="seccion location-grid">
        <div className="location-copy reveal">
          <span className="eyebrow"><MapPinned size={14} />Ubicacion</span>
          <h2>Nos vemos en Barrio Maranonal.</h2>
          <p>{location.address}</p>
          <div className="location-actions">
            <button className="btn btn-principal" type="button" onClick={onMapa}>
              <Navigation size={18} />
              Ver en el mapa
            </button>
            <a className="btn btn-linea" href={location.wazeUrl} target="_blank" rel="noreferrer">
              Abrir Waze
            </a>
            {whatsappUrl && (
              <a className="btn btn-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">
                <MessageCircle size={18} />
                WhatsApp
              </a>
            )}
          </div>
        </div>

        <div className="hours-panel reveal">
          <div className="hours-head">
            <Clock3 size={20} />
            <div>
              <strong>Horario semanal</strong>
              <span>La disponibilidad final aparece al reservar.</span>
            </div>
          </div>
          <div className="hours-list">
            {horarios.map((item) => (
              <div key={item.weekday}>
                <span>{diasSemana[item.weekday]}</span>
                <strong>{item.is_open ? `${horaCorta(item.open_min)} - ${horaCorta(item.close_min)}` : "Cerrado"}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="reviews-strip reveal">
          <div>
            <span>Opiniones en Google</span>
            <h3>Ya te atendiste con Sebas?</h3>
            <p>Tu opinion ayuda a otros clientes a reservar con confianza.</p>
          </div>
          <a className="btn btn-linea" href={location.googleMapsUrl} target="_blank" rel="noreferrer">
            Abrir Google Maps
          </a>
        </div>
      </div>
    </section>
  );
}
