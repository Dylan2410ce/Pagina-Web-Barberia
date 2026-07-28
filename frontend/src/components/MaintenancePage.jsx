import { useEffect } from "react";
import {
  Clock3,
  Instagram,
  MessageCircle,
  RefreshCw,
  Scissors,
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
      <header className="maintenance-header">
        <a className="maintenance-brand" href="/" aria-label="Sebas Barber">
          <span><Scissors size={21} /></span>
          <strong>Sebas Barber</strong>
        </a>
        <span className="maintenance-status">
          <i aria-hidden="true" />
          Pausa breve
        </span>
      </header>

      <section className="maintenance-stage" aria-labelledby="maintenance-title">
        <div className="maintenance-art" aria-hidden="true">
          <span className="maintenance-ring ring-one" />
          <span className="maintenance-ring ring-two" />
          <span className="maintenance-icon">
            <Scissors size={46} strokeWidth={1.6} />
          </span>
          <span className="maintenance-line line-one" />
          <span className="maintenance-line line-two" />
        </div>

        <div className="maintenance-copy">
          <span className="eyebrow">Un momento</span>
          <h1 id="maintenance-title">{status.maintenance_title}</h1>
          <p>{status.maintenance_message}</p>

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
              Escribir por WhatsApp
            </a>
          </div>

          <span className="maintenance-note">
            <Clock3 size={16} />
            {status.maintenance_note}
          </span>
        </div>
      </section>

      <footer className="maintenance-footer">
        <small>© {new Date().getFullYear()} Sebas Barber</small>
        <a
          href="https://www.instagram.com/__andres29__/"
          target="_blank"
          rel="noreferrer"
        >
          <Instagram size={16} />
          Instagram
        </a>
      </footer>
    </main>
  );
}
