import { Readable, Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import handler, { destinoBackend } from "../../api/backend.js";
import configuracionVercel from "../../vercel.json";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function respuestaPrueba() {
  const partes = [];
  const respuesta = new Writable({ write(parte, _encoding, terminar) { partes.push(parte); terminar(); } });
  respuesta.cabeceras = {};
  respuesta.setHeader = (clave, valor) => { respuesta.cabeceras[clave] = valor; };
  respuesta.status = (codigo) => { respuesta.codigo = codigo; return respuesta; };
  respuesta.json = (datos) => respuesta.end(JSON.stringify(datos));
  respuesta.texto = () => Buffer.concat(partes).toString();
  return respuesta;
}

describe("proxy de administración", () => {
  it("conserva consultas y limita las rutas al admin", () => {
    expect(destinoBackend("/api/backend/admin/appointments?date=2026-10-10", "https://api.example.com/"))
      .toBe("https://api.example.com/api/admin/appointments?date=2026-10-10");
    expect(destinoBackend("/api/backend/tasks/run", "https://api.example.com")).toBeNull();
    expect(destinoBackend("/api/backend/admin/../../health", "https://api.example.com")).toBeNull();
  });
  it("resuelve la reescritura de Vercel sin depender de rutas catch-all de Next.js", () => {
    expect(configuracionVercel.rewrites[0]).toEqual({
      source: "/api/backend/admin/:path*", destination: "/api/backend?__ruta=:path*",
    });
    expect(destinoBackend("/api/backend?__ruta=appointments/abc/status&status=completed", "https://api.example.com"))
      .toBe("https://api.example.com/api/admin/appointments/abc/status?status=completed");
    for (const ruta of ["/api/backend", "/api/backend?__ruta=../../health", "/api/backend?__ruta=me&__ruta=team", "/api/backend?__ruta=https://evil.example"]) {
      expect(destinoBackend(ruta, "https://api.example.com")).toBeNull();
    }
  });
  it.each(["http://api.example.com", "https://user:secret@api.example.com", "https://api.example.com?target=evil"])("rechaza destinos inseguros %s", (base) => {
    expect(() => destinoBackend("/api/backend/admin/login", base)).toThrow();
  });

  it("conserva Set-Cookie, transmite JSON y no confía en IP reenviada", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    const solicitud = Readable.from([Buffer.from('{"username":"prueba"}')]);
    Object.assign(solicitud, { url: "/api/backend?__ruta=login", method: "POST", headers: {
      "content-type": "application/json", origin: "https://site.example.com", "x-forwarded-for": "spoofed",
    } });
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"token":"cookie"}', {
      headers: { "content-type": "application/json", "set-cookie": "session=test; HttpOnly; Secure; SameSite=Strict" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const respuesta = respuestaPrueba();
    await handler(solicitud, respuesta);
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/api/admin/login");
    expect(opciones.headers.get("x-forwarded-for")).toBeNull();
    expect(opciones.headers.get("x-session-mode")).toBe("cookie");
    expect(opciones.body.toString()).toBe('{"username":"prueba"}');
    expect(respuesta.cabeceras["Set-Cookie"][0]).toContain("HttpOnly");
    expect(respuesta.codigo).toBe(200);
    expect(respuesta.texto()).toBe('{"token":"cookie"}');
  });
});
