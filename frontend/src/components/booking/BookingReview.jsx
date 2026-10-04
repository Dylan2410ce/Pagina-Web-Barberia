import { dinero, fechaCorta, minutosAHora } from "../../utils/format";

export default function BookingReview({ reserva, resumen, barbero, onEditar }) {
  return <section className="booking-review" aria-labelledby="booking-review-title">
    <h4 id="booking-review-title">Revisa tu cita</h4>
    <dl>
      <div><dt>Servicio</dt><dd>{resumen.servicio?.name}</dd></div>
      <div><dt>Barbero</dt><dd>{barbero?.name}</dd></div>
      <div><dt>Fecha y hora</dt><dd>{fechaCorta(`${reserva.date}T12:00:00-06:00`)} · {resumen.hora || minutosAHora(reserva.start_min)}</dd></div>
      {resumen.extras?.length > 0 && <div><dt>Extras</dt><dd>{resumen.extras.map((item) => item.name).join(", ")}</dd></div>}
      {resumen.descuento > 0 && <div><dt>Descuento</dt><dd>− {dinero(resumen.descuento)}</dd></div>}
      <div className="booking-review-total"><dt>Total a pagar</dt><dd>{dinero(resumen.total)}</dd></div>
    </dl>
    <div className="review-edits"><button type="button" className="text-action" onClick={() => onEditar(1)}>Cambiar servicio o barbero</button><button type="button" className="text-action" onClick={() => onEditar(2)}>Cambiar horario</button></div>
    <p>Cancelaciones hasta {barbero?.cancellation_notice_hours ?? 2} h antes. Cambios de horario hasta {barbero?.reschedule_notice_hours ?? 2} h antes. <a href="/terminos-reserva" target="_blank" rel="noreferrer">Condiciones de reserva</a>.</p>
  </section>;
}
