# Sebas Barber

Sistema de reservas, agenda y CRM para Sebastián y Gabriel.

- Frontend: React 19, Vite, CSS3, Tailwind CSS y Lucide.
- Backend: FastAPI, Pydantic v2 y SQLAlchemy Async.
- Base de datos: PostgreSQL en Neon.
- Calendarios: Google Calendar independiente para cada barbero.
- Operación: PWA instalable, auditoría, CRM y disponibilidad especial.

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
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
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
NOTIFY_EMAILS_ENABLED=false
REMINDERS_ENABLED=false
REMINDER_LEAD_HOURS=24
REMINDER_BATCH_SIZE=50
REMINDER_TASK_TOKEN=TOKEN_ALEATORIO_LARGO
```

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
está disponible. Las tablas, índices y migraciones compatibles se aplican al
iniciar Render; no hay un comando manual de migración.

Los recordatorios quedan desactivados por defecto. Para activarlos configura
SMTP, cambia `REMINDERS_ENABLED=true` y ejecuta periódicamente:

```txt
EMAIL_PROVIDER=smtp
NOTIFY_EMAILS_ENABLED=false
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=usuario_smtp
SMTP_PASSWORD=clave_smtp
SMTP_FROM=reservas@tu-dominio.com
```

`NOTIFY_EMAILS_ENABLED=false` conserva EmailJS para las confirmaciones
inmediatas y usa SMTP únicamente para recordatorios. La tarea protegida es:

```txt
POST https://TU-SERVICIO.onrender.com/api/tasks/reminders
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

## EmailJS

EmailJS se ejecuta desde el frontend. No requiere variables adicionales en
Render. En Vercel, las seis variables del bloque anterior deben existir para
los entornos **Production**, **Preview** y **Development**.

Configura ambos templates con estos campos:

```txt
To Email: {{to_email}}
From Name: {{from_name}}
Reply To: {{reply_to}}
Subject: {{email_subject}}
```

Template del cliente:

```txt
{{email_title}}

{{email_message}}
```

Template del barbero:

```txt
{{email_title}}

{{email_message}}
```

Cada envío recibe también las variables individuales de la cita:

```txt
{{appointment_id}}
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

El panel incluye estados de cita, exportación CSV, historial y frecuencia de
clientes, feriados, vacaciones y una bitácora independiente por barbero.

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
python -m unittest discover -s tests -v
```
