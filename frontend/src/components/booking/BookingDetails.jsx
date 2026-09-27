import { useRef, useState } from "react";
import { ArrowLeft, CircleCheckBig, ShieldCheck } from "lucide-react";
import FormField from "../ui/FormField";
import { validarNombre, validarTelefono } from "../../utils/validation";

export default function BookingDetails({ reserva, actualizar, onSubmit, onBack, recordarContacto, onRecordarContacto }) {
  const enviandoRef = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const enviar = async (event) => {
    event.preventDefault();
    const formulario = event.currentTarget;
    formulario.elements.client_name.setCustomValidity(validarNombre(reserva.client_name));
    formulario.elements.client_phone.setCustomValidity(validarTelefono(reserva.client_phone));
    if (!formulario.checkValidity()) {
      formulario.querySelector(":invalid")?.focus();
      return;
    }
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    try { await onSubmit(event); }
    finally { enviandoRef.current = false; setEnviando(false); }
  };
  return (
    <form className="wizard-stage formulario" onSubmit={enviar} noValidate aria-busy={enviando}>
      <div className="honeypot" aria-hidden="true"><label htmlFor="booking-website">Sitio web</label><input id="booking-website" name="website" tabIndex="-1" autoComplete="off" value={reserva.website || ""} onChange={(event) => actualizar("website", event.target.value)} /></div>
      <div className="stage-heading"><span>3 de 3</span><h3>¿A nombre de quién?</h3><p>Ya casi. Solo faltan tus datos.</p></div>
      <FormField id="client-name" name="client_name" label="Nombre completo" value={reserva.client_name} validate={validarNombre} minLength={3} maxLength={80} autoComplete="name" required placeholder="Tu nombre y apellido" onChange={(event) => actualizar("client_name", event.target.value)} />
      <div className="form-doble">
        <FormField id="client-phone" name="client_phone" label="WhatsApp" value={reserva.client_phone} validate={validarTelefono} inputMode="tel" maxLength={8} autoComplete="tel-national" required placeholder="8888 7777" hint="8 dígitos, sin +506." onChange={(event) => actualizar("client_phone", event.target.value)} />
        <FormField id="client-email" name="client_email" label="Correo (opcional)" type="email" maxLength={160} value={reserva.client_email} autoComplete="email" placeholder="nombre@correo.com" hint="Recibe el comprobante de tu cita." onChange={(event) => actualizar("client_email", event.target.value)} />
      </div>
      <FormField id="client-notes" label="Detalle del corte (opcional)" maxLength={240} value={reserva.notes} placeholder="Ej.: bajo en los lados y textura arriba" onChange={(event) => actualizar("notes", event.target.value)} />
      <p className="privacy-note"><ShieldCheck size={17} />Tus datos se usan para gestionar esta cita.</p>
      <label className="remember-contact"><input type="checkbox" checked={Boolean(recordarContacto)} onChange={(event) => onRecordarContacto?.(event.target.checked)} />Recordar mis datos en este dispositivo</label>
      <div className="wizard-actions">
        <button className="btn btn-linea" type="button" onClick={onBack} disabled={enviando}><ArrowLeft size={18} />Volver</button>
        <button className="btn btn-principal" type="submit" disabled={enviando}>{enviando ? <span className="spinner" /> : <CircleCheckBig size={18} />}{enviando ? "Confirmando…" : "Confirmar cita"}</button>
      </div>
    </form>
  );
}
