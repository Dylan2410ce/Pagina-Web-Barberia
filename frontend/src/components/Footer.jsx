import { ArrowUpRight, Code2, MapPin, MessageCircle, Scissors } from "lucide-react";
import { UBICACION } from "../config/business";

export default function Footer({ location = UBICACION }) {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-main">
          <div className="site-footer-brand">
            <span className="site-footer-mark"><Scissors size={24} aria-hidden="true" /></span>
            <strong>Sebas Barber</strong>
            <p>Tu corte. Tu estilo. Tu espacio.</p>
            <a className="site-footer-cta" href="#reserva">Agendar una cita <ArrowUpRight size={18} aria-hidden="true" /></a>
          </div>
          <nav className="site-footer-nav" aria-label="Visita Sebas Barber">
            <h2>Tu próxima visita</h2>
            <a href="#equipo">Barberos</a>
            <a href="#servicios">Servicios</a>
            <a href="#reserva">Reservar</a>
            <a href="#preguntas">Preguntas frecuentes</a>
            <a href="#ubicacion">Ubicación</a>
          </nav>
          <div className="site-footer-contact">
            <h2>Nos vemos en Esparza</h2>
            <p>{location.address}</p>
            <a href={location.googleMapsUrl} target="_blank" rel="noopener noreferrer"><MapPin size={17} aria-hidden="true" />Cómo llegar</a>
            <a href="https://wa.me/50683778700" target="_blank" rel="noopener noreferrer"><MessageCircle size={17} aria-hidden="true" />WhatsApp de Sebastián</a>
          </div>
        </div>
        <div className="site-footer-bottom">
          <nav className="site-footer-policies" aria-label="Información legal">
            <a href="/privacidad">Privacidad</a>
            <a href="/terminos-reserva">Términos de reserva</a>
            <a href="/aviso-cancelacion">Cancelaciones</a>
          </nav>
          <div className="site-footer-signature">
            <small>© {new Date().getFullYear()} Sebas Barber. Todos los derechos reservados.</small>
            <small><Code2 size={14} aria-hidden="true" />Desarrollado por <span>Dylan Calvo Escobar</span></small>
          </div>
        </div>
      </div>
    </footer>
  );
}
