import { CalendarClock, X } from "lucide-react";
import useDialogA11y from "../hooks/useDialogA11y";
import { hoyISO } from "../utils/format";

export default function RescheduleModal({
  data,
  onClose,
  onDate,
  onSlot,
  onConfirm,
}) {
  const dialogRef = useDialogA11y(data ? onClose : null);
  if (!data) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <strong id="reschedule-title"><CalendarClock size={18} />Elige una nueva hora</strong>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body formulario">
          <div className="campo">
            <label htmlFor="reschedule-date">Nueva fecha</label>
            <input
              id="reschedule-date"
              type="date"
              min={hoyISO()}
              value={data.date}
              onChange={(event) => onDate(event.target.value)}
            />
          </div>
          <div className="slots">
            {data.cargando && (
              <div className="slots-vacio"><span className="spinner" />Buscando horas...</div>
            )}
            {!data.cargando && data.slots.map((slot) => (
              <button
                key={slot.start_min}
                className={`slot ${data.start_min === slot.start_min ? "activo" : ""}`}
                type="button"
                aria-pressed={data.start_min === slot.start_min}
                onClick={() => onSlot(slot.start_min)}
              >
                {slot.label}
              </button>
            ))}
            {!data.cargando && data.slots.length === 0 && (
              <div className="slots-vacio">No hay horas libres ese día.</div>
            )}
          </div>
          <button className="btn btn-principal btn-ancho" type="button" onClick={onConfirm} disabled={data.start_min === null}>
            Guardar nueva hora
          </button>
        </div>
      </section>
    </div>
  );
}
