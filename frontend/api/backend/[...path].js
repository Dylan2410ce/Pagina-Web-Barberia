const METODOS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);
const CABECERAS = ["accept", "content-type", "cookie", "origin", "x-csrf-token", "x-session-mode"];

export const config = { api: { bodyParser: false }, maxDuration: 60 };

export function destinoBackend(url, base) {
  const origen = new URL(base);
  if (origen.protocol !== "https:" || origen.username || origen.password || origen.search || origen.hash) {
    throw new Error("Configuración de API inválida");
  }
  const entrada = new URL(url, "https://proxy.local");
  if (!/^\/api\/backend\/admin\/[a-zA-Z0-9/_-]+$/.test(entrada.pathname)) return null;
  return `${origen.origin}${entrada.pathname.replace("/api/backend/", "/api/")}${entrada.search}`;
}

export default async function handler(solicitud, respuesta) {
  respuesta.setHeader("Cache-Control", "no-store");
  respuesta.setHeader("X-Content-Type-Options", "nosniff");
  if (!METODOS.has(solicitud.method)) return respuesta.status(405).end();
  let destino;
  try {
    destino = destinoBackend(solicitud.url, process.env.VITE_API_URL);
  } catch {
    return respuesta.status(503).json({ error: { message: "El panel no está disponible en este momento." } });
  }
  if (!destino) return respuesta.status(404).end();
  const cabeceras = new Headers();
  for (const nombre of CABECERAS) {
    const valor = solicitud.headers[nombre];
    if (typeof valor === "string") cabeceras.set(nombre, valor);
  }
  // La IP reenviada por el visitante nunca se utiliza como identidad de confianza.
  cabeceras.set("x-session-mode", "cookie");
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 55000);
  try {
    let cuerpo;
    if (!["GET", "HEAD"].includes(solicitud.method)) {
      const limite = cabeceras.get("content-type")?.startsWith("multipart/form-data") ? 6 * 1024 * 1024 : 65536;
      const partes = [];
      let cantidad = 0;
      for await (const parte of solicitud) {
        cantidad += parte.length;
        if (cantidad > limite) return respuesta.status(413).json({ error: { message: "El archivo o formulario es demasiado grande." } });
        partes.push(parte);
      }
      cuerpo = Buffer.concat(partes);
    }
    const resultado = await fetch(destino, {
      method: solicitud.method, headers: cabeceras, body: cuerpo,
      signal: controlador.signal, redirect: "error",
    });
    for (const nombre of ["content-type", "retry-after", "x-request-id", "x-ratelimit-limit", "x-ratelimit-remaining"]) {
      const valor = resultado.headers.get(nombre);
      if (valor) respuesta.setHeader(nombre, valor);
    }
    const cookies = resultado.headers.getSetCookie();
    if (cookies.length) respuesta.setHeader("Set-Cookie", cookies);
    respuesta.status(resultado.status);
    if (resultado.status === 204 || solicitud.method === "HEAD") return respuesta.end();
    respuesta.end(Buffer.from(await resultado.arrayBuffer()));
  } catch {
    respuesta.status(503).json({ error: { message: "La agenda está despertando. Intenta de nuevo en unos segundos." } });
  } finally {
    clearTimeout(temporizador);
  }
}
