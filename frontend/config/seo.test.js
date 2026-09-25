import { createHash } from "node:crypto";
import vercelConfig from "../vercel.json";
import { describe, expect, it } from "vitest";
import { datosSEO, politicaCSP } from "./seo.mjs";

describe("SEO y CSP por entorno", () => {
  it("usa el origen exacto configurado para la API sin permitir todo Render", () => {
    const policy = politicaCSP({ VITE_API_URL: "https://otra-api.onrender.com/", VERCEL: "1" });
    expect(policy).toContain("connect-src 'self' https://otra-api.onrender.com");
    expect(policy).not.toContain("*.onrender.com");
    expect(policy).not.toContain("api.emailjs.com");
  });
  it("mantiene el hash CSP sincronizado con los datos estructurados", () => {
    const env = { VITE_API_URL: "https://api.example.com", VITE_SITE_URL: "https://barberia.example.com" };
    const seo = datosSEO(env);
    expect(politicaCSP(env)).toContain(createHash("sha256").update(seo.json).digest("base64"));
    expect(JSON.parse(seo.json)["@type"]).toBe("HairSalon");
    expect(JSON.parse(seo.json).url).toBe("https://barberia.example.com/");
  });
  it("rechaza credenciales y esquemas inseguros", () => {
    expect(() => politicaCSP({ VITE_API_URL: "http://example.com", VERCEL: "1" })).toThrow();
    expect(() => politicaCSP({ VITE_API_URL: "https://user:password@example.com", VERCEL: "1" })).toThrow();
    expect(() => politicaCSP({ VERCEL: "1" })).toThrow();
  });
  it("mantiene la protección de marcos en cabecera y el origen dinámico en meta", () => {
    const header = vercelConfig.headers[0].headers.find((item) => item.key === "Content-Security-Policy").value;
    expect(header).toContain("frame-ancestors 'none'");
    expect(header).not.toContain("connect-src");
    expect(politicaCSP({ VITE_API_URL: "https://api.example.com" }, { enMeta: true })).not.toContain("frame-ancestors");
  });
});
