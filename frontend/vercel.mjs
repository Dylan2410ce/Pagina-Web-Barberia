import { politicaCSP } from "./config/seo.mjs";

export const config = {
  framework: "vite",
  buildCommand: "npm run build",
  outputDirectory: "dist",
  rewrites: [{ source: "/((?!api/).*)", destination: "/index.html" }],
  headers: [
    { source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: politicaCSP() },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ] },
    { source: "/assets/(.*)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    { source: "/sw.js", headers: [
      { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
      { key: "Service-Worker-Allowed", value: "/" },
    ] },
    { source: "/manifest.json", headers: [{ key: "Cache-Control", value: "public, max-age=3600" }] },
    { source: "/(admin|privacidad|terminos-reserva|aviso-cancelacion)(.*)", headers: [
      { key: "X-Robots-Tag", value: "noindex, noarchive" },
      { key: "Cache-Control", value: "no-store" },
    ] },
  ],
};
