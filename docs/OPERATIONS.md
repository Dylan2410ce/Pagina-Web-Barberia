# Operación y despliegue

## Servicios

| Servicio | Plataforma | Responsabilidad |
| --- | --- | --- |
| Frontend | Vercel | React/Vite y Function de mantenimiento |
| Backend | Render | FastAPI y tareas internas |
| Base de datos | Neon | PostgreSQL administrado |
| Calendario | Google Calendar | Disponibilidad por barbero |
| Correo | EmailJS | Confirmaciones y notificaciones |
| Mantenimiento | Vercel Edge Config | Interruptor público |

## Variables de Render

### Base, seguridad y CORS

```text
DATABASE_URL
DATABASE_SSL
SECRET_KEY
SECRET_KEY_PREVIOUS                 # opcional durante rotación
FRONTEND_URL
ADMIN_DEFAULT_PASSWORD              # alternativa a ADMIN_PASSWORD_HASH
ADMIN_PASSWORD_HASH                 # opcional
GABRIEL_DEFAULT_PASSWORD            # alternativa a GABRIEL_PASSWORD_HASH
GABRIEL_PASSWORD_HASH               # opcional
MASTER_RESET_CODE
```

### Google Calendar

```text
GOOGLE_CALENDAR_SEBASTIAN_ID
GOOGLE_CALENDAR_GABRIEL_ID
GOOGLE_CREDENTIALS_JSON             # una fuente posible
GOOGLE_CREDENTIALS_B64              # alternativa
GOOGLE_SERVICE_ACCOUNT_JSON         # alternativa
GOOGLE_CREDENTIALS_FILE             # ruta en el servidor
GOOGLE_APPLICATION_CREDENTIALS     # ruta estándar de Google
CALENDAR_ENABLED
CALENDAR_REQUIRED
```

Usa una sola fuente de credenciales. Nunca subas el JSON al repositorio.
Comparte ambos calendarios con la cuenta de servicio con permiso para
realizar cambios en eventos.

### Correo, tareas y observabilidad

```text
EMAIL_PROVIDER
OWNER_EMAIL
GABRIEL_EMAIL
EMAILJS_SERVICE_ID
EMAILJS_TEMPLATE_CLIENTE
EMAILJS_TEMPLATE_BARBERO
EMAILJS_PUBLIC_KEY
EMAILJS_PRIVATE_KEY
REMINDERS_ENABLED
REMINDER_LEAD_HOURS
REMINDER_BATCH_SIZE
REMINDER_TASK_TOKEN
DAILY_SUMMARY_HOUR
NOTIFICATION_MAX_ATTEMPTS
RETENTION_DAYS
RATE_LIMIT_ENABLED
SENTRY_DSN                         # opcional
```

### Negocio y contenido

```text
APPOINTMENT_BUFFER_MIN
SERVICE_CACHE_TTL_SECONDS
CANCELLATION_NOTICE_HOURS
RESCHEDULE_NOTICE_HOURS
PARKING_INFO
DIRECTIONS_HINT
CLOUDINARY_CLOUD_NAME              # opcionales para galería
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
GALLERY_UPLOAD_MAX_MB
```

Los nombres y valores de ejemplo están en `.env.example`. El valor real se
configura en Render, no en el repositorio.

## Variables de Vercel

```text
EDGE_CONFIG
VITE_API_URL
VITE_EMAILJS_PUBLIC_KEY
VITE_EMAILJS_SERVICE_ID
VITE_EMAILJS_TEMPLATE_CLIENTE
VITE_EMAILJS_TEMPLATE_BARBERO
VITE_BARBERO_EMAIL
```

Las variables `VITE_*` se incluyen en el bundle público. Nunca coloques allí
una contraseña, token de tarea, conexión de base de datos, credencial de
Google o clave privada de EmailJS.

## Despliegue de Render

1. Importa el repositorio y selecciona `backend` como Root Directory.
2. Usa Python 3.12 y los comandos definidos en `render.yaml`.
3. Configura variables antes del primer despliegue.
4. Confirma el health check `/health`.
5. Verifica `/health` y `/health/calendar` después del despliegue.

El comando de inicio ejecuta `alembic upgrade head` antes de arrancar Uvicorn.
No ejecutes migraciones destructivas en producción sin respaldo.

## Despliegue de Vercel

1. Importa el mismo repositorio.
2. Selecciona `frontend` como Root Directory.
3. Usa preset Vite, `npm run build` y salida `dist`.
4. Configura las variables de Vercel.

## Migraciones

El historial actual contiene:

```text
backend/alembic/versions/20260728_01_operations_security.py
backend/alembic/versions/20260728_02_remove_loyalty.py
```

Comandos habituales:

```powershell
cd backend
alembic current
alembic history
alembic upgrade head
```

Para una nueva modificación: actualiza el modelo, crea una migración
revisable, prueba el upgrade y documenta impacto y rollback.

## Cron jobs

Cada cinco minutos:

```http
POST https://TU-SERVICIO.onrender.com/api/tasks/reminders
X-Task-Token: valor_de_REMINDER_TASK_TOKEN
```

Una vez al mes:

```http
POST https://TU-SERVICIO.onrender.com/api/tasks/retention
X-Task-Token: valor_de_REMINDER_TASK_TOKEN
```

Para mantener despierto un servicio gratuito:

```http
GET https://TU-SERVICIO.onrender.com/health
```

No uses el endpoint de health para tareas de negocio.

## Modo mantenimiento

La Function `frontend/api/site-status.js` consulta Edge Config. El store debe
contener:

```json
{
  "maintenance_enabled": false,
  "maintenance_title": "Estamos poniendo todo a punto.",
  "maintenance_message": "La agenda hizo una pausa breve. Volvé en unos minutos y reservá tu espacio con normalidad.",
  "maintenance_note": "Pronto estaremos de vuelta."
}
```

`true` muestra mantenimiento y `false` devuelve la web normal. La ruta
`/admin` permanece disponible. `EDGE_CONFIG` es privada y no debe tener
prefijo `VITE_`.

## Diagnóstico rápido

| Síntoma | Comprobaciones |
| --- | --- |
| Frontend dice `Failed to fetch` | `VITE_API_URL`, CORS, `/health` y logs de Render |
| API devuelve `503` | Neon, `DATABASE_URL`, migraciones y pool |
| Horarios no cargan | `barber_id`, fecha, bloqueos y `/health/calendar` |
| Google no crea eventos | permisos, credenciales y zona horaria |
| No llegan correos | IDs de EmailJS, destinatario, template y límites |
| Admin queda fuera | JWT, usuario, contraseña, `FRONTEND_URL` y `401/403` |
| Mantenimiento no cambia | Edge Config, `EDGE_CONFIG` y `/api/site-status` |

En cada incidente registra hora, endpoint, código HTTP, `X-Request-ID` y
commit desplegado. No copies tokens ni datos personales en tickets.
