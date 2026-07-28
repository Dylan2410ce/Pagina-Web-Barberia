import { useEffect } from "react";
import {
  ArrowUpRight,
  Clock3,
  Instagram,
  MessageCircle,
  RefreshCw,
  Scissors,
  ShieldCheck,
} from "lucide-react";

export default function MaintenancePage({ status, onRefresh }) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Volvemos pronto | Sebas Barber";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <main className="maintenance-page">
      <div className="maintenance-visual" aria-hidden="true">
        <img src="/barberia-hero.jpg" alt="" />
      </div>

      <header className="maintenance-header">
        <div className="maintenance-brand" aria-label="Sebas Barber">
          <span><Scissors size={21} /></span>
          <strong>Sebas Barber</strong>
        </div>
        <span className="maintenance-status">
          <i aria-hidden="true" />
          Agenda en pausa
        </span>
      </header>

      <section className="maintenance-stage" aria-labelledby="maintenance-title">
        <div className="maintenance-copy">
          <span className="maintenance-kicker">
            <Scissors size={15} aria-hidden="true" />
            Pausa breve
          </span>
          <h1 id="maintenance-title">{status.maintenance_title}</h1>
          <p>{status.maintenance_message}</p>

          <div className="maintenance-assurances" aria-label="Estado del servicio">
            <span>
              <ShieldCheck size={17} aria-hidden="true" />
              Tus citas siguen guardadas
            </span>
            <span aria-live="polite">
              <Clock3 size={17} aria-hidden="true" />
              {status.maintenance_note}
            </span>
          </div>

          <div className="maintenance-actions">
            <button
              className="btn btn-principal btn-grande"
              type="button"
              onClick={onRefresh}
              disabled={status.checking}
            >
              <RefreshCw
                className={status.checking ? "is-spinning" : ""}
                size={18}
              />
              {status.checking ? "Revisando..." : "Intentar de nuevo"}
            </button>
            <a
              className="btn btn-whatsapp btn-grande"
              href="https://wa.me/50683778700"
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={18} />
              Hablar con Sebastián
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>

          <p className="maintenance-help">
            ¿Necesitás coordinar algo hoy? Escribinos y te ayudamos.
          </p>
        </div>
      </section>

      <footer className="maintenance-footer">
        <div className="maintenance-legal">
          <small>
            © {new Date().getFullYear()} Sebas Barber. Todos los derechos
            reservados.
          </small>
          <small>
            Diseñado y desarrollado por{" "}
            <strong>Dylan Calvo Escobar</strong>
          </small>
        </div>
        <a
          href="https://www.instagram.com/__andres29__/"
          target="_blank"
          rel="noreferrer"
          aria-label="Instagram de Sebastián"
        >
          <Instagram size={16} />
          Instagram
        </a>
      </footer>
    </main>
  );
}
