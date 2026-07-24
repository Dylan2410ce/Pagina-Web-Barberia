import { Menu, Scissors, X } from "lucide-react";

export default function Navbar({ abierto, solida, onToggle }) {
  const cerrar = () => {
    if (abierto) onToggle();
  };

  return (
    <header className={`navbar ${solida ? "navbar-solida" : ""}`}>
      <nav className="nav-contenido" aria-label="Navegacion principal">
        <a className="marca" href="#inicio" onClick={cerrar} aria-label="Sebas Barber, inicio">
          <span><Scissors size={20} /></span>
          <strong>Sebas Barber</strong>
        </a>
        <button
          className="hamburguesa"
          type="button"
          onClick={onToggle}
          aria-label={abierto ? "Cerrar menu" : "Abrir menu"}
          aria-expanded={abierto}
        >
          {abierto ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className={`nav-links ${abierto ? "abierto" : ""}`}>
          <a href="#servicios" onClick={cerrar}>Servicios</a>
          <a href="#trabajos" onClick={cerrar}>Trabajos</a>
          <a className="nav-reservar" href="#reserva" onClick={cerrar}>Reservar</a>
          <a href="#mis-citas" onClick={cerrar}>Mis citas</a>
          <a href="/admin" onClick={cerrar}>Admin</a>
        </div>
      </nav>
    </header>
  );
}
