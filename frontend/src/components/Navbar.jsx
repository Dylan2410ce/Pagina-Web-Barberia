import { useEffect, useState } from "react";
import { Menu, Scissors, X } from "lucide-react";

const enlaces = [
  { id: "equipo", label: "Equipo" },
  { id: "servicios", label: "Servicios" },
  { id: "ubicacion", label: "Ubicación" },
  { id: "reserva", label: "Reservar", destacado: true },
  { id: "mis-citas", label: "Mis citas" },
];

export default function Navbar({ abierto, solida, onToggle }) {
  const [seccionActiva, setSeccionActiva] = useState("inicio");

  useEffect(() => {
    const secciones = ["inicio", ...enlaces.map((item) => item.id)]
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setSeccionActiva(visible.target.id);
      },
      { rootMargin: "-28% 0px -58% 0px", threshold: [0, 0.1, 0.3] },
    );

    secciones.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const cerrar = () => {
    if (abierto) onToggle();
  };

  const navegar = (event, id) => {
    event.preventDefault();
    cerrar();
    setSeccionActiva(id);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  return (
    <header className={`navbar ${solida ? "navbar-solida" : ""}`}>
      <nav className="nav-contenido" aria-label="Navegación principal">
        <a
          className={`marca ${seccionActiva === "inicio" ? "activa" : ""}`}
          href="#inicio"
          onClick={(event) => navegar(event, "inicio")}
          aria-label="Sebas Barber, volver al inicio"
          aria-current={seccionActiva === "inicio" ? "page" : undefined}
        >
          <span><Scissors size={20} /></span>
          <strong>Sebas Barber</strong>
        </a>
        <button
          className="hamburguesa"
          type="button"
          onClick={onToggle}
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={abierto}
        >
          {abierto ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className={`nav-links ${abierto ? "abierto" : ""}`}>
          {enlaces.map((item) => (
            <a
              className={[
                item.destacado ? "nav-reservar" : "",
                seccionActiva === item.id ? "activo" : "",
              ].filter(Boolean).join(" ")}
              href={`#${item.id}`}
              key={item.id}
              onClick={(event) => navegar(event, item.id)}
              aria-current={seccionActiva === item.id ? "location" : undefined}
            >
              {item.label}
            </a>
          ))}
          <a href="/admin" onClick={cerrar}>Admin</a>
        </div>
      </nav>
    </header>
  );
}
