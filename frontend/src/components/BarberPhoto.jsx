import { useState } from "react";

const FOTOS = {
  sebastian: "/assets/fotosbarberias/Sebastian.png",
  gabriel: "/assets/fotosbarberias/Gabriel.png",
};

function claveFoto(nombre = "") {
  return nombre
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-CR");
}

export default function BarberPhoto({ nombre, compacta = false }) {
  const [error, setError] = useState(false);
  const src = FOTOS[claveFoto(nombre)];
  const inicial = nombre?.trim().slice(0, 1).toUpperCase() || "S";

  return (
    <span className={`barber-photo ${compacta ? "barber-photo-compacta" : ""}`}>
      <span className="barber-photo-fallback" aria-hidden="true">{inicial}</span>
      {src && !error && (
        <img
          src={src}
          alt={`Retrato de ${nombre}`}
          loading="lazy"
          decoding="async"
          onError={() => setError(true)}
        />
      )}
    </span>
  );
}
