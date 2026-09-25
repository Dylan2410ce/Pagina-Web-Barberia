import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { datosSEO, descripcion, politicaCSP, servicios, titulo } from "./seo.mjs";

const escapar = (valor) => String(valor).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export default function seoPlugin(env) {
  const seo = datosSEO(env);
  let salida;
  return {
    name: "sebas-seo",
    apply: "build",
    configResolved(config) { salida = resolve(config.root, config.build.outDir); },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const verificacion = env.GOOGLE_SITE_VERIFICATION
          ? '<meta name="google-site-verification" content="' + escapar(env.GOOGLE_SITE_VERIFICATION) + '" />' : "";
        const meta = '<meta http-equiv="Content-Security-Policy" content="' + escapar(politicaCSP(env, { enMeta: true })) + '" />'
          + '<title>' + titulo + '</title>'
          + '<meta name="description" content="' + descripcion + '" />'
          + '<link rel="canonical" href="' + seo.origen + '/" />'
          + '<meta property="og:locale" content="es_CR" /><meta property="og:type" content="website" />'
          + '<meta property="og:site_name" content="Sebas Barber" />'
          + '<meta property="og:title" content="' + titulo + '" /><meta property="og:description" content="' + descripcion + '" />'
          + '<meta property="og:url" content="' + seo.origen + '/" /><meta property="og:image" content="' + seo.origen + '/barberia-hero.jpg" />'
          + '<meta property="og:image:alt" content="Barbería Sebas Barber en Esparza" />'
          + '<meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="' + titulo + '" />'
          + '<meta name="twitter:description" content="' + descripcion + '" /><meta name="twitter:image" content="' + seo.origen + '/barberia-hero.jpg" />'
          + '<meta name="build-sha" content="' + escapar(env.VERCEL_GIT_COMMIT_SHA || env.BUILD_SHA || "local") + '" />'
          + verificacion + '<script type="application/ld+json">' + seo.json + '</script>';
        const portada = '<main class="static-landing"><section class="hero"><div class="hero-overlay"></div><div class="hero-inner seccion"><div class="hero-copy">'
          + '<p class="hero-kicker">Barbería en Esparza</p><h1>Sebas Barber</h1>'
          + '<p class="hero-lead">Cortes precisos, barba bien definida y tu espacio reservado desde el celular.</p>'
          + '<div class="hero-acciones"><a class="btn btn-principal" href="#reserva">Reservar cita online</a>'
          + '<a class="btn btn-cristal" href="https://www.google.com/maps?q=10.002565,-84.657672">Cómo llegar</a></div></div></div></section>'
          + '<section class="seccion"><h2>Servicios y precios</h2><ul class="static-menu">'
          + servicios.map((servicio) => '<li><strong>' + servicio.nombre + '</strong><span>₡' + servicio.precio.toLocaleString("es-CR") + ' · ' + servicio.minutos + ' min</span></li>').join("")
          + '</ul></section><section id="reserva" class="seccion"><h2>Reserva tu cita</h2><p>Selecciona tu servicio y tu barbero para consultar la agenda.</p>'
          + '<noscript>Para reservar online, activa JavaScript o llámanos al <a href="tel:+50683778700">8377 8700</a>.</noscript></section>'
          + '<section class="seccion"><h2>Ubicación y horario</h2><p>C. 19, Barrio Marañonal, Espíritu Santo, Esparza, Puntarenas.</p>'
          + '<p>Martes a sábado, de 8:00 a. m. a 7:00 p. m. Consulta la disponibilidad de tu barbero al reservar.</p></section></main>';
        return html.replace("<!-- SEO -->", meta).replace('<div id="root"></div>', '<div id="root">' + portada + '</div>');
      },
    },
    async closeBundle() {
      const html = await readFile(resolve(salida, "index.html"), "utf8");
      const version = createHash("sha256").update(html).digest("hex").slice(0, 16);
      const worker = await readFile(resolve(salida, "sw.js"), "utf8");
      await writeFile(resolve(salida, "sw.js"), worker.replace("__BUILD_VERSION__", version));
      await writeFile(resolve(salida, "robots.txt"), "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /*?reserva=\nSitemap: " + seo.origen + "/sitemap.xml\n");
      await writeFile(resolve(salida, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + seo.origen + '/</loc></url></urlset>\n');
    },
  };
}
