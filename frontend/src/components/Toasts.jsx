import { AlertTriangle, CircleCheck, Info, X } from "lucide-react";

const ICONOS = {
  ok: CircleCheck,
  error: AlertTriangle,
  warning: Info,
};

export default function Toasts({ items, onClose }) {
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {items.map((item) => {
        const Icon = ICONOS[item.tipo] || Info;
        return (
          <article
            className={`toast toast-${item.tipo}`}
            key={item.id}
            role={item.tipo === "error" ? "alert" : "status"}
          >
            <Icon className="toast-icon" size={19} />
            <div>
              <strong>{item.titulo}</strong>
              {item.mensaje && <span>{item.mensaje}</span>}
            </div>
            <button type="button" onClick={() => onClose(item.id)} aria-label="Cerrar"><X size={16} /></button>
          </article>
        );
      })}
    </div>
  );
}
