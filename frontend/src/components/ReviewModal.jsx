import { useState } from "react";
import { Send, Star, X } from "lucide-react";
import useDialogA11y from "../hooks/useDialogA11y";

export default function ReviewModal({ cita, onClose, onSubmit }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [website, setWebsite] = useState("");
  const dialogRef = useDialogA11y(onClose);

  if (!cita) return null;

  const submit = async (event) => {
    event.preventDefault();
    const saved = await onSubmit({
      access_code: cita._access_code,
      rating,
      comment: comment.trim(),
      website,
    });
    if (saved) onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="modal review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="modal-kicker">Tu experiencia</span>
            <strong id="review-title">¿Cómo quedó tu corte?</strong>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>
        <form className="modal-body formulario" onSubmit={submit}>
          <div className="honeypot" aria-hidden="true">
            <label htmlFor="review-website">Sitio web</label>
            <input
              id="review-website"
              tabIndex="-1"
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>
          <div className="rating-picker">
            <span>Calificación</span>
            <div role="radiogroup" aria-label="Calificación de la cita">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} ${value === 1 ? "estrella" : "estrellas"}`}
                  onClick={() => setRating(value)}
                >
                  <Star
                    size={28}
                    fill={value <= rating ? "currentColor" : "none"}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="campo">
            <label htmlFor="review-comment">Comentario</label>
            <textarea
              id="review-comment"
              minLength={8}
              maxLength={400}
              rows={4}
              value={comment}
              placeholder="Cuéntanos qué te gustó del servicio"
              onChange={(event) => setComment(event.target.value)}
              required
            />
          </div>
          <p className="privacy-note">
            La reseña se publicará después de una revisión breve.
          </p>
          <button className="btn btn-principal btn-ancho" type="submit">
            <Send size={17} />
            Enviar reseña
          </button>
        </form>
      </section>
    </div>
  );
}
