import { Map, Navigation, X } from "lucide-react";

export default function MapModal({ location, onClose }) {
  return (
    <div className="modal-backdrop">
      <section className="modal">
        <header>
          <strong>Ubicación</strong>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </header>
        <div className="modal-body">
          <iframe
            className="mapa-frame"
            title="Mapa Sebas Barber"
            loading="lazy"
            src={`https://maps.google.com/maps?q=${location.lat},${location.lng}&z=16&output=embed`}
          />
          <div className="modal-actions">
            <a className="btn btn-secundario" href={location.googleMapsUrl} target="_blank" rel="noreferrer"><Map size={17} />Google Maps</a>
            <a className="btn btn-principal" href={location.wazeUrl} target="_blank" rel="noreferrer"><Navigation size={17} />Waze</a>
          </div>
        </div>
      </section>
    </div>
  );
}
