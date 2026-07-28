import { useEffect, useState } from "react";
import { BellRing, Clock3, X } from "lucide-react";
import useDialogA11y from "../hooks/useDialogA11y";
import { limpiarTelefono } from "../utils/format";

const initialForm = {
  client_name: "",
  client_phone: "",
  client_email: "",
  preferred_period: "any",
  notes: "",
};

export default function WaitlistModal({
  open,
  reserva,
  resumen,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(initialForm);
  const dialogRef = useDialogA11y(open ? onClose : null);

  useEffect(() => {
    if (!open) return;
    setForm((current) => ({
      ...current,
      client_name: reserva.client_name || current.client_name,
      client_phone: reserva.client_phone || current.client_phone,
      client_email: reserva.client_email || current.client_email,
    }));
  }, [open, reserva.client_email, reserva.client_name, reserva.client_phone]);

  if (!open) return null;

  const update = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: field === "client_phone" ? limpiarTelefono(value) : value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const saved = await onSubmit({
      ...form,
      client_email: form.client_email.trim() || null,
      notes: form.notes.trim() || null,
    });
    if (saved) {
      setForm(initialForm);
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="modal waitlist-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="waitlist-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="modal-kicker"><BellRing size={16} />Lista de espera</span>
            <strong id="waitlist-title">Te avisamos si se libera un espacio.</strong>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>
        <form className="modal-body formulario waitlist-form" onSubmit={submit}>
          <div className="waitlist-context">
            <Clock3 size={18} />
            <span>
              <strong>{resumen.servicio?.name}</strong>
              {resumen.barbero?.name} · {reserva.date}
            </span>
          </div>
          <div className="campo">
            <label htmlFor="waitlist-name">Nombre completo</label>
            <input
              id="waitlist-name"
              value={form.client_name}
              minLength={3}
              maxLength={80}
              autoComplete="name"
              onChange={(event) => update("client_name", event.target.value)}
              required
            />
          </div>
          <div className="form-doble">
            <div className="campo">
              <label htmlFor="waitlist-phone">WhatsApp</label>
              <input
                id="waitlist-phone"
                value={form.client_phone}
                inputMode="numeric"
                pattern="[24678][0-9]{7}"
                maxLength={8}
                autoComplete="tel"
                onChange={(event) => update("client_phone", event.target.value)}
                required
              />
            </div>
            <div className="campo">
              <label htmlFor="waitlist-email">Correo (opcional)</label>
              <input
                id="waitlist-email"
                type="email"
                maxLength={160}
                value={form.client_email}
                autoComplete="email"
                onChange={(event) => update("client_email", event.target.value)}
              />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="waitlist-period">Horario preferido</label>
            <select
              id="waitlist-period"
              value={form.preferred_period}
              onChange={(event) => update("preferred_period", event.target.value)}
            >
              <option value="any">Cualquier hora</option>
              <option value="morning">En la mañana</option>
              <option value="afternoon">En la tarde</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="waitlist-notes">Detalle (opcional)</label>
            <input
              id="waitlist-notes"
              maxLength={240}
              value={form.notes}
              placeholder="Ej.: puedo llegar después de las 3:00 p. m."
              onChange={(event) => update("notes", event.target.value)}
            />
          </div>
          <button className="btn btn-principal btn-ancho" type="submit">
            <BellRing size={17} />
            Unirme a la lista
          </button>
        </form>
      </section>
    </div>
  );
}
