import { describe, expect, it } from "vitest";
import { normalizarBarberos } from "./barbers";

describe("Perfiles dinámicos", () => {
  it("conserva el enlace real de cada perfil sin sustituirlo por el de otro barbero", () => {
    const perfil = { name: "Sebastián nuevo", instagram_url: "https://www.instagram.com/otro_barbero/" };
    expect(normalizarBarberos([perfil])[0].instagram_url).toBe(perfil.instagram_url);
  });
  it("no publica enlaces ejecutables o de otros dominios", () => {
    expect(normalizarBarberos([{ instagram_url: "javascript:alert(1)" }, { instagram_url: "https://instagram.com.evil.test/" }]).every((perfil) => perfil.instagram_url === null)).toBe(true);
  });
});
