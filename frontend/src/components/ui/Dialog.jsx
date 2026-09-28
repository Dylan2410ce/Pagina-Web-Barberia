import { useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import useDialogA11y from "../../hooks/useDialogA11y";

export default function Dialog({ title, onClose, children }) {
  const id = useId();
  const ref = useDialogA11y(onClose);
  return createPortal(
    <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal ui-dialog" ref={ref} role="dialog" aria-modal="true" aria-labelledby={id}>
        <header className="ui-dialog-head"><h2 id={id}>{title}</h2><button className="icon-btn labeled-action" type="button" title="Cerrar" aria-label="Cerrar ventana" onClick={onClose}><X size={18} /><span>Cerrar</span></button></header>
        {children}
      </section>
    </div>, document.body,
  );
}
