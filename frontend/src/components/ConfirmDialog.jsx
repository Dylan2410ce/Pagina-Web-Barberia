import { AlertCircle, X } from "lucide-react";
import useDialogA11y from "../hooks/useDialogA11y";

export default function ConfirmDialog({ config, onCancel, onConfirm }) {
  const dialogRef = useDialogA11y(config ? onCancel : null);
  if (!config) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        ref={dialogRef}
        className="modal confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="icon-btn confirm-close" type="button" onClick={onCancel} aria-label="Cerrar">
          <X size={18} />
        </button>
        <span className={`confirm-icon ${config.danger ? "danger" : ""}`}>
          <AlertCircle size={25} />
        </span>
        <div>
          <h2 id="confirm-title">{config.title}</h2>
          <p id="confirm-description">{config.message}</p>
        </div>
        <div className="modal-actions">
          <button className="btn btn-linea" type="button" onClick={onCancel}>Volver</button>
          <button className={`btn ${config.danger ? "btn-peligro" : "btn-principal"}`} type="button" onClick={onConfirm}>
            {config.confirmLabel || "Confirmar"}
          </button>
        </div>
      </section>
    </div>
  );
}
