import {
  CalendarCheck2,
  Check,
  Instagram,
  MessageCircle,
  Phone,
  Scissors,
} from "lucide-react";
import BarberPhoto from "./BarberPhoto";

function whatsappUrl(phone) {
  return `https://wa.me/506${String(phone || "").replace(/\D/g, "")}`;
}

function phoneUrl(phone) {
  return `tel:+506${String(phone || "").replace(/\D/g, "")}`;
}

function telefonoDisponible(phone) {
  const limpio = String(phone || "").replace(/\D/g, "");
  return /^[24678]\d{7}$/.test(limpio) && !/^0+$/.test(limpio);
}

export default function TeamSection({ barberos, seleccionado, onSeleccionar }) {
  return (
    <section id="equipo" className="seccion bloque team-section">
      <div className="cabecera-seccion reveal">
        <div>
          <span className="eyebrow">Nuestro equipo</span>
          <h2>Tu estilo, en buenas manos.</h2>
          <p>Elige con quién atenderte y reserva directamente.</p>
        </div>
      </div>

      <div className="team-grid reveal">
        {barberos.map((barbero, index) => {
          const activo = seleccionado === barbero.id;
          return (
            <article className={`team-card ${activo ? "activo" : ""}`} key={barbero.id}>
              <div className={`team-visual team-visual-${index + 1}`}>
                <BarberPhoto nombre={barbero.name} />
                <span className="team-photo-accent"><Scissors size={24} /></span>
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
                  {barbero.name.toLocaleLowerCase("es-CR").startsWith("sebas")
                    ? "Degradados precisos, textura limpia y atención al detalle."
                    : "Cortes actuales, acabados definidos y trato directo."}
                </p>
                <div className="team-contact" aria-label={`Contacto de ${barbero.name}`}>
                  {barbero.instagram_url && (
                    <a
                      href={barbero.instagram_url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Instagram de ${barbero.name}`}
                      title="Instagram"
                    >
                      <Instagram size={18} />
                    </a>
                  )}
                  {telefonoDisponible(barbero.phone) && (
                    <>
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
                    </>
                  )}
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
