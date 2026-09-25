import { afterEach, describe, expect, it, vi } from "vitest";
import { publicoApi } from "./client";

afterEach(() => vi.unstubAllGlobals());

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
});
