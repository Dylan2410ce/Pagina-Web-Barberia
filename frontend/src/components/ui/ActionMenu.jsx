import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

export default function ActionMenu({ label = "Más acciones", actions }) {
  const [abierto, setAbierto] = useState(false);
  const [arriba, setArriba] = useState(false);
  const contenedor = useRef(null);
  const boton = useRef(null);
  const id = useId();
  useLayoutEffect(() => {
    if (abierto) setArriba(window.innerHeight - boton.current.getBoundingClientRect().bottom < actions.length * 48 + 24);
  }, [abierto, actions.length]);
  useEffect(() => {
    if (!abierto) return undefined;
    contenedor.current?.querySelector('[role="menuitem"]')?.focus();
    const cerrarFuera = (event) => { if (!contenedor.current?.contains(event.target)) setAbierto(false); };
    document.addEventListener("pointerdown", cerrarFuera);
    return () => document.removeEventListener("pointerdown", cerrarFuera);
  }, [abierto]);
  const teclado = (event) => {
    if (event.key === "Escape") { setAbierto(false); boton.current?.focus(); }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && abierto) {
      event.preventDefault();
      const opciones = [...contenedor.current.querySelectorAll('[role="menuitem"]')];
      const actual = opciones.indexOf(document.activeElement);
      const siguiente = event.key === "Home" ? 0 : event.key === "End" ? opciones.length - 1
        : (actual + (event.key === "ArrowDown" ? 1 : -1) + opciones.length) % opciones.length;
      opciones[siguiente]?.focus();
    }
  };
  if (!actions.length) return null;
  return (
    <div className="action-menu" ref={contenedor} onKeyDown={teclado} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setAbierto(false); }}>
      <button ref={boton} className="icon-btn labeled-action" type="button" title={label} aria-label={label} aria-haspopup="menu" aria-expanded={abierto} aria-controls={abierto ? id : undefined} onClick={() => setAbierto(!abierto)}><MoreHorizontal size={20} /><span>Más</span></button>
      {abierto && <div className={`action-menu-list ${arriba ? "opens-up" : ""}`} id={id} role="menu" aria-label={label}>
        {actions.map(({ label: texto, icon: Icon, onClick, danger }) => (
          <button key={texto} type="button" role="menuitem" className={danger ? "action-danger" : ""} onClick={() => { setAbierto(false); boton.current?.focus(); onClick(); }}>
            {Icon && <Icon size={16} />} {texto}
          </button>
        ))}
      </div>}
    </div>
  );
}
