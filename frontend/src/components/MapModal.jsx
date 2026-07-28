import { Map, Navigation, X } from "lucide-react";
import useDialogA11y from "../hooks/useDialogA11y";

export default function MapModal({ location, onClose }) {
  const dialogRef = useDialogA11y(onClose);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <strong id="map-title">Ubicación</strong>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">
          <iframe
            className="mapa-frame"
            title="Mapa de Sebas Barber"
            loading="lazy"
            src={`https://maps.google.com/maps?q=${location.lat},${location.lng}&z=16&output=embed`}
          />
          <div className="modal-actions">
            <a className="btn btn-secundario" href={location.googleMapsUrl} target="_blank" rel="noreferrer">
              <Map size={17} />
              Google Maps
            </a>
            <a className="btn btn-principal" href={location.wazeUrl} target="_blank" rel="noreferrer">
              <Navigation size={17} />
              Waze
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
