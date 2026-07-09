import React from "react";
import { Lock, MapPin, Menu, Scissors, X } from "lucide-react";

export function Navbar({ menuOpen, setMenuOpen, onMap, onAdmin }) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const update = () => setScrolled(window.scrollY > 18);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const close = () => setMenuOpen(false);

  return (
    <header className={scrolled ? "navbar solid" : "navbar"}>
      <div className="nav-inner">
        <a className="brand" href="#top" onClick={close}>
          <span className="brand-mark"><Scissors size={18} /></span>
          <span>Barberia Sebas</span>
        </a>

        <button
          type="button"
          className={menuOpen ? "hamburger open" : "hamburger"}
          aria-expanded={menuOpen}
          aria-label="Abrir menu"
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <nav className={menuOpen ? "nav-menu open" : "nav-menu"}>
          <a href="#servicios" onClick={close}>Servicios</a>
          <a href="#reservar" onClick={close}>Agendar</a>
          <button type="button" onClick={() => { onMap(); close(); }}>
            <MapPin size={16} /> Ubicacion
          </button>
          <button type="button" onClick={() => { onAdmin(); close(); }}>
            <Lock size={16} /> Admin
          </button>
        </nav>
      </div>
    </header>
  );
}
