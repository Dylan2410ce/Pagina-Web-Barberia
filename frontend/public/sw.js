const CACHE_NAME = "sebas-barber-__BUILD_VERSION__";
const OFFLINE_PAGE = "/offline.html";
const MAX_ASSETS = 50;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([
    OFFLINE_PAGE, "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png",
  ])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("sebas-barber-") && key !== CACHE_NAME) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

async function guardar(request, response) {
  if (!response.ok || response.type === "opaque") return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
  const keys = await cache.keys();
  const assets = keys.filter((item) => new URL(item.url).pathname.startsWith("/assets/"));
  for (const key of assets.slice(0, Math.max(0, assets.length - MAX_ASSETS))) await cache.delete(key);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    // No persistir HTML de administracion ni URLs que puedan contener datos privados.
    const cacheable = url.pathname === "/" && !url.search;
    const network = fetch(request);
    event.waitUntil(network.then((response) => cacheable ? guardar("/", response.clone()) : undefined).catch(() => {}));
    event.respondWith(network.catch(async () => (
      (cacheable && await caches.match("/")) || await caches.match(OFFLINE_PAGE)
      || new Response("Sin conexión. Intenta de nuevo.", { status: 503 })
    )));
    return;
  }
  if (!url.pathname.startsWith("/assets/") && !url.pathname.startsWith("/icons/")) return;
  const network = fetch(request);
  event.waitUntil(network.then((response) => guardar(request, response.clone())).catch(() => {}));
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) { network.catch(() => {}); return cached; }
    return network.catch(() => new Response("", { status: 503 }));
  })());
});
