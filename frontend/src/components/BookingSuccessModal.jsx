import { CalendarCheck2, Check, X } from "lucide-react";
import { dinero, fechaHumana } from "../utils/format";

export default function BookingSuccessModal({ cita, onClose }) {
  return (
    <div className="modal-backdrop booking-success-backdrop" role="presentation">
      <section
        className="booking-success max-w-lg overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-success-title"
      >
        <button className="icon-btn booking-success-close" type="button" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>
        <div className="booking-success-icon">
          <Check size={30} strokeWidth={3} />
        </div>
        <span className="eyebrow"><CalendarCheck2 size={14} />Reserva confirmada</span>
        <h2 id="booking-success-title">Tu espacio ya es tuyo.</h2>
        <p>Te esperamos en Sebas Barber. Guarda estos datos para tenerlos a mano.</p>

        <dl className="booking-success-summary grid gap-3">
          <div><dt>Servicio</dt><dd>{cita.service_name}</dd></div>
          <div><dt>Fecha y hora</dt><dd>{fechaHumana(cita.starts_at)}</dd></div>
          <div><dt>A nombre de</dt><dd>{cita.client_name}</dd></div>
          <div><dt>Total</dt><dd>{dinero(cita.total_price)}</dd></div>
        </dl>

        <button className="btn btn-principal btn-ancho" type="button" onClick={onClose}>
          Listo
        </button>
      </section>
    </div>
  );
}
