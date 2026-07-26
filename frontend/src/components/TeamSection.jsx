import {
  CalendarCheck2,
  Check,
  Instagram,
  MessageCircle,
  Phone,
  Scissors,
} from "lucide-react";

function whatsappUrl(phone) {
  return `https://wa.me/506${String(phone || "").replace(/\D/g, "")}`;
}

function phoneUrl(phone) {
  return `tel:+506${String(phone || "").replace(/\D/g, "")}`;
}

export default function TeamSection({ barberos, seleccionado, onSeleccionar }) {
  return (
    <section id="equipo" className="seccion bloque team-section">
      <div className="cabecera-seccion reveal">
        <div>
          <span className="eyebrow">Nuestro equipo</span>
          <h2>Elige tu barbero.</h2>
          <p>Dos agendas independientes, los mismos servicios y precios claros.</p>
        </div>
      </div>

      <div className="team-grid reveal">
        {barberos.map((barbero, index) => {
          const activo = seleccionado === barbero.id;
          return (
            <article className={`team-card ${activo ? "activo" : ""}`} key={barbero.id}>
              <div className={`team-visual team-visual-${index + 1}`}>
                <span>{barbero.name.slice(0, 1)}</span>
                <Scissors size={32} />
              </div>
              <div className="team-card-body">
                <div className="team-card-head">
                  <div>
                    <span>{barbero.role}</span>
                    <h3>{barbero.name}</h3>
                  </div>
                  {activo && <span className="team-selected"><Check size={15} />Elegido</span>}
                </div>
                <p>
                  {barbero.name === "Sebastian"
                    ? "Tecnica precisa, degradados limpios y atencion al detalle."
                    : "Cortes actuales, trato directo y una agenda hecha a su ritmo."}
                </p>
                <div className="team-contact" aria-label={`Contacto de ${barbero.name}`}>
                  <a
                    href={barbero.instagram_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Instagram de ${barbero.name}`}
                    title="Instagram"
                  >
                    <Instagram size={18} />
                  </a>
                  <a
                    href={whatsappUrl(barbero.phone)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`WhatsApp de ${barbero.name}`}
                    title="WhatsApp"
                  >
                    <MessageCircle size={18} />
                  </a>
                  <a
                    href={phoneUrl(barbero.phone)}
                    aria-label={`Llamar a ${barbero.name}`}
                    title="Llamar"
                  >
                    <Phone size={18} />
                  </a>
                </div>
                <button
                  className={`btn btn-ancho ${activo ? "btn-secundario" : "btn-principal"}`}
                  type="button"
                  onClick={() => onSeleccionar(barbero.id, true)}
                >
                  <CalendarCheck2 size={18} />
                  {activo ? `Continuar con ${barbero.name}` : `Reservar con ${barbero.name}`}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
