import { RefreshCw } from "lucide-react";

export default function AgendaLoading({ error, onRetry }) {
  return (
    <section id="reserva" className="seccion agenda-loading" aria-busy={!error}>
      <div role="status" aria-live="polite">
        <span className="eyebrow">Reserva online</span>
        <h2>{error ? "La agenda está tardando." : "Estamos abriendo la agenda."}</h2>
        <p>{error ? "Puedes volver a intentarlo sin perder tu selección." : "En un momento podrás elegir tu servicio y tu hora."}</p>
        {error && <button type="button" className="btn btn-principal" onClick={onRetry}><RefreshCw size={18} />Volver a intentar</button>}
      </div>
      {!error && <div className="agenda-skeleton" aria-hidden="true">{[0, 1, 2].map((id) => <div key={id}><span /><span /><span /></div>)}</div>}
    </section>
  );
}
