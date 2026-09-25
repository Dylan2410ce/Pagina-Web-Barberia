import { createHash } from "node:crypto";

export function origenSeguro(valor, nombre, permitirLocal = false) {
  const url = new URL(valor);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash
      || (url.protocol !== "https:" && !(permitirLocal && local && url.protocol === "http:"))) {
    throw new Error(nombre + " debe ser una URL HTTPS sin credenciales.");
  }
  return url.origin;
}

export const titulo = "Sebas Barber | Barbería en Esparza, Puntarenas";
export const descripcion = "Cortes, barba y colorimetría con Sebastián y Gabriel en Barrio Marañonal, Esparza. Consulta precios y reserva tu cita online.";
export const servicios = [
  { nombre: "Mantenimiento de Barba", precio: 2000, minutos: 45 },
  { nombre: "Barba Completa", precio: 3000, minutos: 45 },
  { nombre: "Corte de Cabello", precio: 5000, minutos: 45 },
  { nombre: "Corte Premium", precio: 6000, minutos: 45 },
  { nombre: "Colorimetría / Rayitos", precio: 15000, minutos: 120 },
  { nombre: "Tinte Completo", precio: 20000, minutos: 120 },
];

// Catalogo y horario publico verificados el 2026-09-24. Revisar al cambiar el negocio.
export function datosSEO(env = process.env) {
  const origen = origenSeguro(env.VITE_SITE_URL || "https://sebasbarber.vercel.app", "VITE_SITE_URL", true);
  const schema = {
    "@context": "https://schema.org", "@type": "HairSalon", "@id": origen + "/#negocio",
    name: "Sebas Barber", url: origen + "/", image: origen + "/barberia-hero.jpg",
    telephone: "+50683778700", priceRange: "CRC 2000-20000", currenciesAccepted: "CRC",
    address: { "@type": "PostalAddress", streetAddress: "C. 19, Barrio Marañonal", addressLocality: "Espíritu Santo, Esparza", addressRegion: "Puntarenas", addressCountry: "CR" },
    geo: { "@type": "GeoCoordinates", latitude: 10.002565, longitude: -84.657672 },
    hasMap: "https://www.google.com/maps?q=10.002565,-84.657672",
    openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], opens: "08:00", closes: "19:00" }],
    sameAs: ["https://www.instagram.com/__andres29__/"],
    hasOfferCatalog: { "@type": "OfferCatalog", name: "Servicios de barbería", itemListElement: servicios.map((servicio) => ({
      "@type": "Offer", price: servicio.precio, priceCurrency: "CRC",
      itemOffered: { "@type": "Service", name: servicio.nombre },
    })) },
  };
  const json = JSON.stringify(schema).replace(/</g, "\\u003c");
  return { origen, json, hash: createHash("sha256").update(json).digest("base64") };
}

export function politicaCSP(env = process.env, { enMeta = false } = {}) {
  if (!env.VITE_API_URL && env.VERCEL) throw new Error("Configura VITE_API_URL en Vercel antes de desplegar.");
  const api = origenSeguro(env.VITE_API_URL || "http://localhost:8000", "VITE_API_URL", !env.VERCEL);
  return [
    "default-src 'self'", "base-uri 'self'", "object-src 'none'", !enMeta && "frame-ancestors 'none'", "form-action 'self'",
    "script-src 'self' 'sha256-" + datosSEO(env).hash + "'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: https:", "connect-src 'self' " + api,
    "frame-src https://www.google.com https://maps.google.com", "manifest-src 'self'", "worker-src 'self'", "upgrade-insecure-requests",
  ].filter(Boolean).join("; ");
}
