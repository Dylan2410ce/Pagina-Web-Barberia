import { X } from "lucide-react";

export default function Toasts({ items, onClose }) {
  return (
    <div className="toast-stack">
      {items.map((item) => (
        <article className={`toast toast-${item.tipo}`} key={item.id}>
          <strong>{item.titulo}</strong>
          {item.mensaje && <span>{item.mensaje}</span>}
          <button type="button" onClick={() => onClose(item.id)} aria-label="Cerrar"><X size={16} /></button>
        </article>
      ))}
    </div>
  );
}
