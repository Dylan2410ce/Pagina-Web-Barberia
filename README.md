# Sebas Barber

Sistema de reservas, agenda y CRM para Sebastián y Gabriel.

- Frontend: React 19, Vite, CSS3, Tailwind CSS y Lucide.
- Backend: FastAPI, Pydantic v2 y SQLAlchemy Async.
- Base de datos: PostgreSQL en Neon.
- Calendarios: Google Calendar independiente para cada barbero.
- Operación: PWA, auditoría, CRM, lista de espera, promociones,
  gastos, cierres de caja, encuestas privadas y recordatorios automáticos.

## Estructura

```txt
sebas-barber/
|-- backend/
|   |-- app/
|   |   |-- controllers/
|   |   |-- repositories/
|   |   |-- routers/
|   |   |-- services/
|   |   |-- config.py
|   |   |-- database.py
|   |   |-- main.py
|   |   |-- models.py
|   |   `-- schemas.py
|   |-- tests/
|   `-- requirements.txt
|-- frontend/
|   |-- public/
|   |   `-- assets/fotosbarberias/
|   |-- src/
|   |   |-- api/
|   |   |-- components/
|   |   |-- services/
|   |   |-- utils/
|   |   |-- App.jsx
|   |   `-- styles.css
|   |-- vercel.json
|   `-- package.json
|-- .env.example
`-- render.yaml
```

## Render

```txt
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
Health Check Path: /health
```

Variables obligatorias:

```txt
PYTHON_VERSION=3.12.11
DATABASE_URL=postgresql://USUARIO:CLAVE@HOST-POOLER/neondb?sslmode=require
DATABASE_SSL=require
FRONTEND_URL=https://sebasbarber.vercel.app
SECRET_KEY=CLAVE_ALEATORIA_LARGA
ADMIN_DEFAULT_PASSWORD=CLAVE_INICIAL_DE_SEBASTIAN
GABRIEL_DEFAULT_PASSWORD=CLAVE_INICIAL_DE_GABRIEL
MASTER_RESET_CODE=CODIGO_ALFANUMERICO_LARGO
GOOGLE_CALENDAR_SEBASTIAN_ID=sebasbarberg2021@gmail.com
GOOGLE_CALENDAR_GABRIEL_ID=ce553e6aad32461bfe8a2e22e9ace248af0810c8e987115572b8db28d227bd7a@group.calendar.google.com
GOOGLE_CREDENTIALS_JSON=CONTENIDO_COMPLETO_DEL_JSON
CALENDAR_ENABLED=true
CALENDAR_REQUIRED=true
APPOINTMENT_BUFFER_MIN=0
SERVICE_CACHE_TTL_SECONDS=300
REMINDERS_ENABLED=true
REMINDER_LEAD_HOURS=24
REMINDER_BATCH_SIZE=50
REMINDER_TASK_TOKEN=TOKEN_ALEATORIO_LARGO
DAILY_SUMMARY_HOUR=6
NOTIFICATION_MAX_ATTEMPTS=4
RETENTION_DAYS=730
RATE_LIMIT_ENABLED=true
OWNER_EMAIL=sebasbarberg2021@gmail.com
GABRIEL_EMAIL=CORREO_DE_GABRIEL
EMAIL_PROVIDER=emailjs
EMAILJS_SERVICE_ID=SERVICE_ID_DE_EMAILJS
EMAILJS_TEMPLATE_CLIENTE=TEMPLATE_ID_DEL_CLIENTE
EMAILJS_TEMPLATE_BARBERO=TEMPLATE_ID_DEL_BARBERO
EMAILJS_PUBLIC_KEY=PUBLIC_KEY_DE_EMAILJS
EMAILJS_PRIVATE_KEY=PRIVATE_KEY_DE_EMAILJS
```

Para subir fotos desde el panel configura también una cuenta de Cloudinary:

```txt
CLOUDINARY_CLOUD_NAME=NOMBRE_DEL_CLOUD
CLOUDINARY_API_KEY=API_KEY
CLOUDINARY_API_SECRET=API_SECRET
GALLERY_UPLOAD_MAX_MB=5
```

Estas cuatro variables son opcionales. Sin ellas, la galería sigue aceptando
imágenes mediante una URL HTTPS.

`ADMIN_PASSWORD_HASH` y `GABRIEL_PASSWORD_HASH` son alternativas opcionales a
las contraseñas iniciales. No configures ambos mecanismos para la misma cuenta.

Comparte ambos calendarios con la cuenta de servicio incluida en el JSON y
otórgale el permiso **Realizar cambios en eventos**. El backend usa
`America/Costa_Rica` y RFC3339 para todas las operaciones.

Diagnóstico:

```txt
https://TU-SERVICIO.onrender.com/health
https://TU-SERVICIO.onrender.com/health/calendar
```

`/health` comprueba la conexión con PostgreSQL y devuelve `503` cuando Neon no
está disponible. Alembic aplica las migraciones antes de iniciar la API. El
arranque conserva además migraciones idempotentes para instalaciones previas.

Los recordatorios usan el mismo template de EmailJS del cliente. La tarea
persistente reintenta fallos, evita duplicados y envía el correo al cumplirse
las 24 horas previas a la cita:

```txt
EMAIL_PROVIDER=emailjs
REMINDERS_ENABLED=true
EMAILJS_SERVICE_ID=...
EMAILJS_TEMPLATE_CLIENTE=...
EMAILJS_TEMPLATE_BARBERO=...
EMAILJS_PUBLIC_KEY=...
EMAILJS_PRIVATE_KEY=...
```

```txt
POST https://TU-SERVICIO.onrender.com/api/tasks/reminders
X-Task-Token: valor_de_REMINDER_TASK_TOKEN
```

Programa esa petición cada 5 minutos. Para la limpieza de datos antiguos,
programa una vez al mes:

```txt
POST https://TU-SERVICIO.onrender.com/api/tasks/retention
X-Task-Token: valor_de_REMINDER_TASK_TOKEN
```

Para mantener despierto el servicio gratuito configura en cron-job.org una
solicitud `GET` cada 10 minutos a:

```txt
https://pagina-web-barberia.onrender.com/health
```

## Vercel

```txt
Root Directory: frontend
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

Variables obligatorias:

```txt
VITE_API_URL=https://TU-SERVICIO.onrender.com
VITE_EMAILJS_PUBLIC_KEY=PUBLIC_KEY_DE_EMAILJS
VITE_EMAILJS_SERVICE_ID=SERVICE_ID_DE_EMAILJS
VITE_EMAILJS_TEMPLATE_CLIENTE=TEMPLATE_ID_DEL_CLIENTE
VITE_EMAILJS_TEMPLATE_BARBERO=TEMPLATE_ID_DEL_BARBERO
VITE_BARBERO_EMAIL=CORREO_QUE_RECIBE_LAS_RESERVAS
```

### Modo mantenimiento sin deploy

El frontend consulta una Vercel Function conectada a Edge Config. Crea un
store llamado `sebas-barber-control`, conéctalo al proyecto y guarda estos
items:

```json
{
  "maintenance_enabled": false,
  "maintenance_title": "Estamos poniendo todo a punto.",
  "maintenance_message": "La agenda hizo una pausa breve. Volvé en unos minutos y reservá tu espacio con normalidad.",
  "maintenance_note": "Pronto estaremos de vuelta."
}
```

Vercel crea automáticamente la variable privada `EDGE_CONFIG` al conectar el
store. Realiza un único redeploy después de conectarlo. A partir de ahí, cambia
solo `maintenance_enabled` desde **Storage > Edge Config > Items**:

```txt
true  = muestra la página de mantenimiento
false = muestra la web normal
```

No agregues `VITE_` al nombre ni expongas el valor de `EDGE_CONFIG`. La ruta
`/admin` permanece disponible durante la pausa y ningún cliente o barbero puede
modificar los items del store.

## EmailJS

EmailJS se ejecuta en el frontend para confirmaciones inmediatas y en Render
para recordatorios, lista de espera y resúmenes diarios. Las variables
`EMAILJS_*` deben existir en ambos servicios; `EMAILJS_PRIVATE_KEY` solo se
guarda en Render y nunca se expone en Vercel.

Configura ambos templates con estos campos:

```txt
To Email: {{to_email}}
From Name: {{from_name}}
Reply To: {{reply_to}}
Subject: {{email_subject}}
```

Template del cliente:

Usa el HTML completo de `docs/emailjs-template-cliente.html`. En la pestaña
**Attachments** del template agrega un **Variable Attachment** con:

```txt
Filename: reserva-{{access_code}}.png
Content type: image/png
Parameter name: qr_code
```

El CID utilizado dentro del HTML es `qr_code`. La confirmación y el
recordatorio de 24 horas generan el PNG localmente; la clave privada no se
envía a servicios externos para construir el QR.

Template del barbero:

```txt
{{email_title}}

{{email_message}}
```

Cada envío recibe también las variables individuales de la cita:

```txt
{{appointment_id}}
{{access_code}}
{{shop_name}}
{{barber_name}}
{{barber_email}}
{{client_name}}
{{client_phone}}
{{client_email}}
{{service_name}}
{{addons}}
{{appointment_date}}
{{appointment_time}}
{{appointment_datetime}}
{{duration}}
{{total_price}}
{{notes}}
{{location}}
{{maps_url}}
{{waze_url}}
{{manage_url}}
{{notification_type}}
{{recipient_name}}
{{booking_code}}
{{reservation_code}}
{{security_notice}}
{{notification_badge}}
{{manage_button_label}}
{{qr_code}}
{{has_booking_details}}
{{has_access_code}}
{{has_manage_action}}
{{has_qr}}
{{is_confirmation}}
{{is_reminder}}
{{is_reschedule}}
{{is_cancellation}}
{{is_waitlist}}
```

Los templates antiguos pueden seguir usando estos alias compatibles:

```txt
{{customer_name}}
{{phone}}
{{barber}}
{{service}}
{{extras}}
{{starts_at}}
{{total}}
```

## Fotos

Coloca y confirma en Git estos dos archivos:

```txt
frontend/public/assets/fotosbarberias/Sebastian.png
frontend/public/assets/fotosbarberias/Gabriel.png
```

Respeta exactamente mayúsculas, extensión y nombres. Si una imagen todavía no
existe, la interfaz muestra la inicial del barbero sin romper la tarjeta.

## Admin

```txt
Sebastián: usuario sebas
Gabriel: usuario gabriel
```

Cada sesión queda asociada a un barbero. Citas, horarios, bloqueos, clientes,
reportes y calendario se filtran en el servidor por ese perfil.

El panel incluye estados de cita, exportación CSV, historial, etiquetas y
preferencias del cliente, feriados, vacaciones, pausas recurrentes, lista de
espera, promociones, gastos, cierres diarios, encuestas privadas, trazabilidad
de correos, galería y bitácora independiente por barbero.

## PWA y legales

La web puede instalarse desde el navegador móvil. El manifiesto, los iconos y
el Service Worker viven en `frontend/public/`. Las páginas legales son:

```txt
/privacidad
/terminos-reserva
/aviso-cancelacion
```

## Pruebas

```txt
cd frontend
npm test
npm run build

cd ../backend
python -m pytest -q
```
