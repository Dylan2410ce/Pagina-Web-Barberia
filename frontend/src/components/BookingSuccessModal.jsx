import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  CalendarPlus,
  Check,
  Clipboard,
  Download,
  KeyRound,
  ShieldCheck,
  X,
} from "lucide-react";
import useDialogA11y from "../hooks/useDialogA11y";
import { descargarIcs, googleCalendarUrl } from "../utils/calendar";
import { dinero, fechaHumana } from "../utils/format";

async function copiar(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

export default function BookingSuccessModal({ cita, barbero, onClose }) {
  const [copiado, setCopiado] = useState(false);
  const dialogRef = useDialogA11y(onClose);
  const codigo = cita.access_code || "";
  const urlGestion = typeof window === "undefined"
    ? codigo
    : `${window.location.origin}/#mis-citas?reserva=${encodeURIComponent(codigo)}`;

  const copiarCodigo = async () => {
    await copiar(codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  };

  return (
    <div
      className="modal-backdrop booking-success-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        ref={dialogRef}
        className="booking-success"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-success-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="icon-btn booking-success-close"
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
        <div className="booking-success-head">
          <span className="booking-success-icon"><Check size={28} strokeWidth={3} /></span>
          <div>
            <span className="eyebrow">Reserva confirmada</span>
            <h2 id="booking-success-title">Tu espacio ya es tuyo.</h2>
            <p>Guarda el código para consultar, mover o cancelar la cita.</p>
          </div>
        </div>

        <div className="booking-receipt">
          <dl className="booking-success-summary">
            <div><dt>Servicio</dt><dd>{cita.service_name}</dd></div>
            <div><dt>Barbero</dt><dd>{barbero?.name || "Sebas Barber"}</dd></div>
            <div><dt>Fecha y hora</dt><dd>{fechaHumana(cita.starts_at)}</dd></div>
            <div><dt>Total</dt><dd>{dinero(cita.total_price)}</dd></div>
          </dl>
          {codigo && (
            <div className="booking-code-panel">
              <QRCodeSVG
                className="booking-qr"
                value={urlGestion}
                size={112}
                bgColor="#fffaf0"
                fgColor="#151714"
                level="M"
                title="Código QR de la reserva"
              />
              <div>
                <span><KeyRound size={15} />Código privado</span>
                <strong>{codigo}</strong>
                <button className="text-action" type="button" onClick={copiarCodigo}>
                  {copiado ? <Check size={15} /> : <Clipboard size={15} />}
                  {copiado ? "Copiado" : "Copiar código"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="booking-calendar-actions">
          <a
            className="btn btn-principal"
            href={googleCalendarUrl(cita, barbero)}
            target="_blank"
            rel="noreferrer"
          >
            <CalendarPlus size={17} />
            Google Calendar
          </a>
          <button
            className="btn btn-linea"
            type="button"
            onClick={() => descargarIcs(cita, barbero)}
          >
            <Download size={17} />
            Otro calendario
          </button>
        </div>
        <p className="booking-security-note">
          <ShieldCheck size={16} />
          El código funciona como llave de acceso. No lo publiques.
        </p>
        <button className="btn btn-secundario btn-ancho" type="button" onClick={onClose}>
          Entendido
        </button>
      </section>
    </div>
  );
}
