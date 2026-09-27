import { useId, useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";

export default function FormField({ id, label, hint, validate, onChange, onBlur, ...props }) {
  const generado = useId();
  const identificador = id || generado;
  const [revisado, setRevisado] = useState(false);
  const [error, setError] = useState("");
  const [completo, setCompleto] = useState(false);

  const revisar = (campo) => {
    const mensaje = validate?.(campo.value) || "";
    campo.setCustomValidity(mensaje);
    let detalle = mensaje;
    if (!detalle && !campo.validity.valid) {
      if (campo.validity.valueMissing) detalle = "Completa este campo.";
      else if (campo.validity.typeMismatch) detalle = "Escribe un correo válido, como nombre@correo.com.";
      else if (campo.validity.patternMismatch) detalle = "Revisa el formato de este campo.";
      else detalle = campo.validationMessage;
    }
    setError(detalle);
    setCompleto(Boolean(campo.value.trim()) && !detalle);
  };

  return (
    <div className={`campo field ${revisado ? error ? "field-invalid" : completo ? "field-valid" : "" : ""}`}>
      <label htmlFor={identificador}>{label}</label>
      <div className="field-control">
        <input
          {...props}
          id={identificador}
          aria-invalid={revisado && Boolean(error)}
          aria-describedby={hint || (revisado && error) ? `${identificador}-ayuda` : undefined}
          onChange={(event) => {
            event.currentTarget.setCustomValidity("");
            if (revisado) revisar(event.currentTarget);
            onChange?.(event);
          }}
          onBlur={(event) => { setRevisado(true); revisar(event.currentTarget); onBlur?.(event); }}
          onInvalid={(event) => { setRevisado(true); revisar(event.currentTarget); }}
        />
        {revisado && (error || completo) && <span className="field-icon" aria-hidden="true">{error ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />}</span>}
      </div>
      <small id={`${identificador}-ayuda`} className="field-message" aria-live="polite">{revisado && error ? error : hint}</small>
    </div>
  );
}
