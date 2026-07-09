import React from "react";
import { Navigation, X } from "lucide-react";

export function MapModal({ location, onClose }) {
  return (
    <div className="overlay">
      <section className="modal map-modal">
        <button className="close" onClick={onClose} aria-label="Cerrar"><X /></button>
        <span className="eyebrow">Ubicacion</span>
        <h2>{location.name}</h2>
        <p className="muted">{location.address}</p>
        <iframe title="Mapa" src={`https://maps.google.com/maps?q=${location.lat},${location.lng}&z=16&output=embed`} />
        <div className="map-actions">
          <a className="btn btn-soft" href={location.googleMapsUrl} target="_blank" rel="noreferrer">Google Maps</a>
          <a className="btn btn-primary" href={location.wazeUrl} target="_blank" rel="noreferrer"><Navigation size={16} /> Waze</a>
        </div>
      </section>
    </div>
  );
}
