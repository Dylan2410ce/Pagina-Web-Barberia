import { useState } from "react";
import { MessageSquareText, Send, X } from "lucide-react";
import useDialogA11y from "../hooks/useDialogA11y";

function Scale({ label, value, onChange }) {
  return (
    <fieldset className="feedback-scale">
      <legend>{label}</legend>
      <div>
        {[1, 2, 3, 4, 5].map((item) => (
          <button
            className={value === item ? "activo" : ""}
            key={item}
            type="button"
            aria-pressed={value === item}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <small><span>Puede mejorar</span><span>Excelente</span></small>
    </fieldset>
  );
}

export default function FeedbackModal({ cita, onClose, onSubmit }) {
  const [form, setForm] = useState({
    satisfaction: 5,
    booking_ease: 5,
    would_return: true,
    private_comment: "",
    website: "",
  });
  const dialogRef = useDialogA11y(onClose);

  const submit = async (event) => {
    event.preventDefault();
    const saved = await onSubmit({
      ...form,
      access_code: cita._access_code,
      private_comment: form.private_comment.trim() || null,
    });
    if (saved) onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="modal feedback-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="modal-kicker"><MessageSquareText size={16} />Encuesta privada</span>
            <strong id="feedback-title">Ayúdanos a afinar el servicio.</strong>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>
        <form className="modal-body formulario" onSubmit={submit}>
          <div className="honeypot" aria-hidden="true">
            <label htmlFor="feedback-website">Sitio web</label>
            <input
              id="feedback-website"
              tabIndex="-1"
              autoComplete="off"
              value={form.website}
              onChange={(event) => setForm((current) => ({
                ...current,
                website: event.target.value,
              }))}
            />
          </div>
          <Scale
            label="¿Qué tan satisfecho quedaste?"
            value={form.satisfaction}
            onChange={(value) => setForm((current) => ({
              ...current,
              satisfaction: value,
            }))}
          />
          <Scale
            label="¿Qué tan fácil fue reservar?"
            value={form.booking_ease}
            onChange={(value) => setForm((current) => ({
              ...current,
              booking_ease: value,
            }))}
          />
          <label className="remember-contact">
            <input
              type="checkbox"
              checked={form.would_return}
              onChange={(event) => setForm((current) => ({
                ...current,
                would_return: event.target.checked,
              }))}
            />
            Volvería a reservar
          </label>
          <div className="campo">
            <label htmlFor="feedback-comment">Comentario privado (opcional)</label>
            <textarea
              id="feedback-comment"
              rows="3"
              maxLength="500"
              value={form.private_comment}
              placeholder="Cuéntanos qué podemos mejorar"
              onChange={(event) => setForm((current) => ({
                ...current,
                private_comment: event.target.value,
              }))}
            />
          </div>
          <button className="btn btn-principal btn-ancho" type="submit">
            <Send size={17} />
            Enviar encuesta
          </button>
        </form>
      </section>
    </div>
  );
}
