import { Menu, Scissors } from "lucide-react";

export default function Navbar({ abierto, solida, onToggle }) {
  const cerrar = () => {
    if (abierto) onToggle();
  };

  return (
    <header className={`navbar ${solida ? "navbar-solida" : ""}`}>
      <nav className="nav-contenido">
        <a className="marca" href="#inicio" onClick={cerrar} aria-label="Sebas Barber">
          <span><Scissors size={20} /></span>
          <strong>Sebas Barber</strong>
        </a>
        <button className="hamburguesa" type="button" onClick={onToggle} aria-label="Abrir menú">
          <Menu size={22} />
        </button>
        <div className={`nav-links ${abierto ? "abierto" : ""}`}>
          <a href="#servicios" onClick={cerrar}>Menú</a>
          <a href="#reserva" onClick={cerrar}>Reservar</a>
          <a href="#mis-citas" onClick={cerrar}>Mis citas</a>
          <a href="#admin" onClick={cerrar}>Admin</a>
        </div>
      </nav>
    </header>
  );
}
