import { AlertTriangle, CircleCheck, Info, X } from "lucide-react";
import { useEffect, useState } from "react";

const ICONOS = {
  ok: CircleCheck,
  error: AlertTriangle,
  warning: Info,
};

function ToastItem({ item, onClose }) {
  const [pausado, setPausado] = useState(false);
  const Icon = ICONOS[item.tipo] || Info;
  useEffect(() => {
    if (pausado) return undefined;
    const timer = window.setTimeout(() => onClose(item.id), item.tipo === "error" ? 10000 : 6000);
    return () => window.clearTimeout(timer);
  }, [item.id, item.tipo, onClose, pausado]);
  return (
    <article className={`toast toast-${item.tipo}`} role={item.tipo === "error" ? "alert" : "status"}
      onMouseEnter={() => setPausado(true)} onMouseLeave={(event) => setPausado(event.currentTarget.contains(document.activeElement))}
      onFocus={() => setPausado(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPausado(false); }}>
      <Icon className="toast-icon" size={20} aria-hidden="true" />
      <div><strong>{item.titulo}</strong>{item.mensaje && <span>{item.mensaje}</span>}</div>
      <button type="button" onClick={() => onClose(item.id)} aria-label={`Cerrar: ${item.titulo}`} title="Cerrar notificación"><X size={18} /></button>
    </article>
  );
}

export default function Toasts({ items, onClose }) {
  return (
    <div className="toast-stack" aria-label="Notificaciones">
      {items.map((item) => <ToastItem item={item} onClose={onClose} key={item.id} />)}
    </div>
  );
}
