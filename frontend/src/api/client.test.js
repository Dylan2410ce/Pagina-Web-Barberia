import { afterEach, describe, expect, it, vi } from "vitest";
import { publicoApi, adminApi, guardarToken, obtenerToken, borrarToken } from "./client";

afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); localStorage.clear(); });

describe("privacidad de reservas", () => {
  it("envía el código exclusivamente en el cuerpo POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const codigo = "SB-ABCD-EFGH-JKLM-NPQR";
    await publicoApi.buscarPorCodigo(codigo);
    await publicoApi.historialPorCodigo(codigo);
    for (const [url, options] of fetchMock.mock.calls) {
      expect(url).not.toContain(codigo);
      expect(url).not.toContain("?");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toEqual({ access_code: codigo });
    }
  });

  it("no fuerza preflight en consultas públicas sin cuerpo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await publicoApi.iniciar();
    expect(fetchMock.mock.calls[0][1].headers["Content-Type"]).toBeUndefined();
  });

  it("no almacena JWT y envía credenciales con protección CSRF", async () => {
    guardarToken("JWT_NO_DEBE_GUARDARSE", "csrf-de-prueba");
    expect(obtenerToken()).toBe("cookie");
    expect(JSON.stringify(sessionStorage)).not.toContain("JWT_NO_DEBE_GUARDARSE");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    await adminApi.logout();
    const opciones = fetchMock.mock.calls[0][1];
    expect(opciones.credentials).toBe("include");
    expect(opciones.headers.Authorization).toBeUndefined();
    expect(opciones.headers["X-CSRF-Token"]).toBe("csrf-de-prueba");
    borrarToken();
    expect(obtenerToken()).toBe("");
  });
});
