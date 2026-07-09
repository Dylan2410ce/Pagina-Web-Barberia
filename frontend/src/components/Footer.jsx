import React from "react";
import { Navigation } from "lucide-react";

export function Footer({ location, onMap }) {
  return (
    <footer className="site-footer">
      <p>{location.address}</p>
      <button type="button" className="btn btn-soft" onClick={onMap}><Navigation size={16} /> Abrir rutas</button>
    </footer>
  );
}
