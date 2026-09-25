# Actualización: fiabilidad, seguridad y SEO

## Alcance y límites

No requiere Redis, colas administradas, workers de pago, adjuntos de EmailJS,
Twilio ni tareas programadas de pago. PostgreSQL coordina límites y entregas.
La suspensión de Render y las cuotas siguen existiendo: no se promete disponibilidad
continua ni correo exactamente a las 24 horas si el servidor está dormido.

**Compatibilidad técnica no equivale a autorización comercial:** Vercel indica que
Hobby es para uso personal no comercial. Una barbería comercial debe revisar esa
condición; esta actualización no cambia planes, inicia pruebas de pago ni activa
facturación. [Condiciones de Hobby](https://vercel.com/docs/plans/hobby).

## Fase 1. Arranque y correo único

- `tasks/reminder_cron.py` usa `AsyncSessionLocal`. Se eliminan APScheduler,
  el cron WhatsApp independiente y el envío de correo desde el navegador.
- Cita y filas de `notification_deliveries` se guardan en la misma transacción.
- El correo se procesa después de responder, y se recupera desde la cola al despertar.
- `dispatch_leases` permite un despachador a la vez, también entre procesos.
- `notification_budgets` contabiliza intentos mensuales, incluidos rechazos/timeouts.
- `sent` no se vuelve a enviar. `processing` abandonado pasa a `uncertain`.
  Revisa el historial de EmailJS antes de cualquier reenvío manual.
- No es posible prometer exactly-once con EmailJS: su API no ofrece una clave
  de idempotencia. Se prioriza evitar duplicados en resultados ambiguos.
- El recordatorio usa el mismo template del cliente, programado 24 h antes.
  Una reserva realizada con menos de 24 h recibe confirmación, no otro aviso inmediato.

EmailJS Free admite actualmente 200 solicitudes al mes y dos templates. El límite
interno predeterminado es 180 intentos. Dos confirmaciones y un recordatorio pueden
consumir tres solicitudes por cita; no equivale a 180 reservas.
La allowlist de dominios no está incluida en Free: no actives una opción de pago.
[Precios oficiales](https://www.emailjs.com/pricing/).

### EmailJS

1. Conserva tus dos templates y el servicio conectado.
2. En ambos templates: **To Email** = `{{to_email}}`, **Subject** = `{{email_subject}}`,
   **Reply To** = `{{reply_to}}`.
3. Permite solicitudes de aplicaciones no navegador en la configuración de seguridad
   de EmailJS, necesaria para llamar desde Render.
4. Configura los IDs y la public key solo en Render. Si tu cuenta permite autenticación
   con private key, usa `EMAILJS_PRIVATE_KEY` solo allí; no es un requisito de pago.
5. Conserva `{{manage_url}}`, `{{access_code}}`, `{{barber_name}}`,
   `{{appointment_date}}`, `{{appointment_time}}`, `{{maps_url}}` y `{{waze_url}}`.
   No configures attachments ni `cid:`. El QR está en el comprobante web.
6. Revisa el consumo actual: fija `EMAIL_MONTHLY_LIMIT` a un valor igual o inferior al
   saldo disponible antes de activar los envíos. El contador nuevo no conoce consumo
   previo ni envíos de otras aplicaciones. El período local usa el mes calendario UTC.
7. Elimina las claves anteriores del bundle con el nuevo deploy. Si una clave quedó
   expuesta previamente, revócala/rotála en el proveedor, no basta con borrarla del código.

## Fase 2. Privacidad y límites

La consulta pública ahora usa:

```http
POST /api/public/appointments/lookup
Content-Type: application/json

{"access_code":"SB-XXXX-XXXX-XXXX-XXXX"}
```

`POST /api/public/appointments/history` exige el mismo cuerpo. No hay consulta por
teléfono ni código en el path/query. Las mutaciones requieren el código en JSON.
Los enlaces privados existentes usan un fragmento del navegador, no una query HTTP;
la aplicación lo retira de la barra al abrirse. No publiques esos enlaces.

`rate_limit_buckets` usa incremento atómico y expiración indexada. Los contadores
sobreviven a reinicios. Se eliminan filas vencidas durante el tráfico; no hay proceso
de limpieza que mantenga Neon despierto. Las IP se guardan como HMAC, no en claro.
Un fallo de la BD devuelve 503 y no desactiva el límite.

El proxy solo se confía si su IP pertenece a `TRUSTED_PROXY_CIDRS`. La cadena
`X-Forwarded-For` se lee de derecha a izquierda, descartando los saltos confiables.
No uses `--forwarded-allow-ips='*'`: permitiría alterar el cliente antes del middleware.
La configuración de Render usa rangos privados de ingreso; en otra infraestructura
configura exclusivamente sus proxies reales, nunca `0.0.0.0/0`.

`ENVIRONMENT=production` deshabilita `/docs`, `/redoc` y `/openapi.json`.
El rate limit reduce abuso; no sustituye la protección de red contra un DDoS distribuido.

## Fase 3. Render, Neon y migración

En **Render → servicio de la API → Settings**:

```text
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT --no-proxy-headers
Health Check Path: /health
```

No necesitas Pre-deploy Command, un worker independiente ni un plan de pago.
Si el servicio se creó manualmente, editar `render.yaml` NO actualiza sus settings:
cambia el Start Command en el dashboard.

Antes de desplegar, conserva un respaldo de tu base según las herramientas disponibles
en tu plan. No ejecutes `stamp`, `downgrade` ni borres tablas para resolver un error.
La revisión `20260924_03` agrega las tablas de control y `claimed_at`, consolida cambios
heredados y mantiene la restricción PostgreSQL contra solapamientos.
El lifespan de FastAPI no ejecuta `create_all`, `ALTER` ni `DROP`.

Para ejecutar manualmente, con variables del proceso ya configuradas:

```powershell
cd backend
python -m pip install -r requirements.txt
python -m alembic current
python -m alembic upgrade head
python -m alembic current
```

Render lo ejecuta automáticamente con el Start Command indicado. La revisión final
debe ser `20260924_03`. Un segundo `upgrade head` no debe repetir la migración.
Se usa TLS con verificación de certificado, pool de 2 conexiones + 1 extra,
`pool_pre_ping=True`, `pool_recycle=300` y timeouts acotados.

### Variables nuevas o modificadas de Render

```text
ENVIRONMENT=production
FRONTEND_URL=https://sebasbarber.vercel.app
TRUSTED_PROXY_CIDRS=127.0.0.1/32,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,fc00::/7
EMAIL_MONTHLY_LIMIT=180
DAILY_SUMMARIES_ENABLED=false
NOTIFICATION_POLL_SECONDS=300
REMINDERS_ENABLED=true
REMINDER_LEAD_HOURS=24
RATE_LIMIT_ENABLED=true
DATABASE_SSL=require
```

**180 es un máximo predeterminado, no una instrucción para ignorar el saldo actual.**
Conserva estas variables existentes con sus valores reales:

```text
DATABASE_URL
SECRET_KEY
MASTER_RESET_CODE
ADMIN_DEFAULT_PASSWORD o ADMIN_PASSWORD_HASH
GABRIEL_DEFAULT_PASSWORD o GABRIEL_PASSWORD_HASH
GOOGLE_CALENDAR_SEBASTIAN_ID
GOOGLE_CALENDAR_GABRIEL_ID
GOOGLE_CREDENTIALS_JSON (o tu Secret File ya configurado)
CALENDAR_ENABLED=true
CALENDAR_REQUIRED=true
EMAILJS_SERVICE_ID
EMAILJS_TEMPLATE_CLIENTE
EMAILJS_TEMPLATE_BARBERO
EMAILJS_PUBLIC_KEY
OWNER_EMAIL=sebasbarberg2021@gmail.com
GABRIEL_EMAIL
REMINDER_TASK_TOKEN
```

`EMAILJS_PRIVATE_KEY` es opcional. Conserva las opciones de negocio y galería que ya
uses. SMTP, Resend y `TWILIO_*` ya no participan en este flujo. No cambies
`SECRET_KEY` indiscriminadamente: protege JWT y códigos cifrados; para rotación
conserva temporalmente `SECRET_KEY_PREVIOUS`.
`RENDER_GIT_COMMIT` lo proporciona Render: no lo copies manualmente.

### Health y cron-job.org

- Liveness/versionado: **https://pagina-web-barberia.onrender.com/health**.
  Responde 200 con `status`, `commit` y `version`, sin consultar Neon.
- Readiness: **https://pagina-web-barberia.onrender.com/health/ready**.
  Comprueba Neon con timeout y responde 503 si no está disponible.
- Los logs de Calendar muestran operación, tipo de excepción y estado HTTP;
  no imprimen tokens, cuerpos de Google, nombres ni correos.

En cron-job.org crea una tarea para `POST`
`https://pagina-web-barberia.onrender.com/api/tasks/reminders`,
con header `X-Task-Token: <tu REMINDER_TASK_TOKEN real>`. No pongas el token en la URL.
Usa cada 15 minutos durante el horario que necesites, zona `America/Costa_Rica`.
El scheduler interno procesa cada 5 minutos solo mientras Render está activo.
Un timeout del cron no pierde la cola: el siguiente intento usa los registros persistentes.
Evita pings 24/7 cuyo único propósito sea impedir sleep.
[Límites de Render Free](https://render.com/docs/free).

## Fase 4. Frontend, caché y Vercel

La portada HTML está generada en el build. React no espera a Render para mostrarla;
la agenda tiene skeleton y botón de reintento. El menú preselecciona el servicio en
el único wizard. Mapa, QR y galería se cargan bajo demanda.

`App.jsx` compone la pantalla; los hooks separan reserva, gestión del cliente y admin.
Los estilos se dividen por responsabilidad en `src/styles/` conservando la cascada.
No reordenes imports sin pruebas visuales.

El service worker ya usaba navegación network-first; ahora su versión se deriva del
HTML generado, limita assets, captura fallos y excluye API, admin y queries privadas.
La reserva nunca funciona offline ni se encola desde el teléfono.

Vercel usa **`vercel.mjs`**, reemplazo oficial de `vercel.json`: la CSP permite
solo el origen exacto de `VITE_API_URL`, no `*.onrender.com`. El hash JSON-LD se
calcula desde la misma fuente que genera el HTML.
[Configuración programática oficial](https://vercel.com/docs/project-configuration/vercel-ts).

En **Vercel → Project → Settings → Environment Variables**, configura:

```text
VITE_API_URL=https://pagina-web-barberia.onrender.com
VITE_SITE_URL=https://sebasbarber.vercel.app
EDGE_CONFIG=<conserva tu conexión actual; no lleva prefijo VITE_>
GOOGLE_SITE_VERIFICATION=<solo el token de verificación HTML, opcional>
```

Elimina `VITE_EMAILJS_PUBLIC_KEY`, `VITE_EMAILJS_SERVICE_ID`,
`VITE_EMAILJS_TEMPLATE_CLIENTE`, `VITE_EMAILJS_TEMPLATE_BARBERO` y
`VITE_BARBERO_EMAIL`. No agregues secretos de Render a Vercel.
Root Directory: `frontend`; preset Vite; build `npm run build`; output `dist`.
Los cambios de variables de build necesitan un nuevo deploy.

## Fase 5. SEO y Search Console

El build genera canonical, descripción, Open Graph, Twitter Card y JSON-LD
`HairSalon`, con coordenadas, servicios, precios y horario público comprobado.
No se inventan reseñas ni estrellas. El catálogo SEO de `frontend/config/seo.mjs`
es una instantánea: actualízalo y reconstruye cuando cambien precios u horarios.
Las horas realmente reservables siempre se consultan al servidor.

El sitemap contiene la portada, única página comercial indexable. Admin y textos
legales llevan `X-Robots-Tag: noindex`; los fragmentos de secciones no son URLs
independientes para el sitemap. `robots.txt` no sustituye autenticación.

1. Abre [Google Search Console](https://search.google.com/search-console/welcome).
2. Elige **Prefijo de la URL** y escribe `https://sebasbarber.vercel.app/`.
   No intentes verificar el dominio `vercel.app`: no controlas su DNS.
3. Elige **Etiqueta HTML**. Copia solo el valor `content` en
   `GOOGLE_SITE_VERIFICATION` de Vercel (no toda la etiqueta).
4. Haz redeploy y comprueba el HTML de la portada; vuelve a Google y pulsa **Verificar**.
5. En **Sitemaps**, envía `https://sebasbarber.vercel.app/sitemap.xml`.
6. En **Inspección de URLs**, inspecciona la portada y solicita indexación.
7. Revisa el marcado con la [prueba de resultados enriquecidos](https://search.google.com/test/rich-results).
8. Mantén nombre, dirección y teléfono consistentes con el Perfil de Empresa de Google.

Con un dominio propio puedes usar la propiedad **Dominio** y un registro DNS TXT.
Cambiar dominio también exige actualizar `VITE_SITE_URL` y `FRONTEND_URL`.
Google decide cuándo indexa y qué muestra: sitemap y marcado no garantizan posiciones.
[Verificación oficial](https://support.google.com/webmasters/answer/9008080?hl=es).

## Verificación reproducible

```powershell
cd backend
python -m pip install -r requirements-test.txt
python -m unittest discover -s tests -v
cd ../frontend
npm ci
npm test
npm run build
npm audit --omit=dev
```

GitHub Actions ejecuta Python 3.12, PostgreSQL 16 desechable, migraciones repetidas,
pruebas de concurrencia y compilación del frontend. Nunca usa credenciales de producción.
No ejecutes los tests PostgreSQL contra Neon de producción: `TEST_POSTGRES_URL`
es exclusivamente para una base desechable.

Después del deploy compara `/health.commit` con el commit Git. La etiqueta
`meta[name="build-sha"]` permite comprobar el frontend. Comprueba además el acceso
por POST, rechazo de búsqueda por teléfono, preselección del servicio, vista móvil
y ausencia de llamadas a EmailJS desde Network del navegador.
