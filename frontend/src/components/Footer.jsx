import { Code2 } from "lucide-react";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-main">
        <div className="footer-brand"><strong>Sebas Barber</strong><span>Tu corte. Tu estilo. Tu espacio.</span></div>
        <nav aria-label="Enlaces del pie de página">
          <a href="#equipo">Barberos</a><a href="#servicios">Servicios</a><a href="#reserva">Reservar</a>
          <a href="#preguntas">Preguntas</a><a href="#ubicacion">Ubicación</a>
          <a href="/privacidad">Privacidad</a><a href="/terminos-reserva">Términos</a><a href="/aviso-cancelacion">Cancelaciones</a>
        </nav>
      </div>
      <div className="footer-legal">
        <small>© {new Date().getFullYear()} Sebas Barber. Todos los derechos reservados.</small>
        <small className="footer-credit"><Code2 size={14} />Desarrollado por <span>Dylan Calvo Escobar</span></small>
      </div>
    </footer>
  );
}
