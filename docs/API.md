# API

Base URL de producción:

```text
https://pagina-web-barberia.onrender.com
```

La API usa JSON. Las fechas de negocio se interpretan en
`America/Costa_Rica`; las fechas intercambiadas con integraciones externas
usan timestamps ISO 8601/RFC3339.

## Errores

Las respuestas de error siguen esta forma:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Revisa los datos enviados",
    "details": []
  }
}
```

| Código | Uso |
| --- | --- |
| `400` | Regla de negocio o solicitud inválida |
| `401` | Falta autenticación o el token expiró |
| `403` | Recurso de otro barbero o acción no permitida |
| `404` | Recurso inexistente |
| `409` | Conflicto de disponibilidad o idempotencia |
| `413` | Payload superior al límite |
| `422` | Error de validación Pydantic |
| `429` | Rate limit alcanzado |
| `503` | PostgreSQL o dependencia crítica no disponible |

## Health checks

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| `GET` | `/` | No | Identidad y estado básico |
| `GET` | `/health` | No | 200, estado, SHA (`commit`) y versión; sin tocar la BD |
| `GET` | `/health/ready` | No | PostgreSQL y latencia; 503 si no está disponible |
| `GET` | `/health/calendar` | No | Credenciales, calendarios y zona horaria |

## Endpoints públicos

### Catálogo y disponibilidad

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/public/init` | Bootstrap de barberos, servicios y configuración |
| `GET` | `/api/public/services` | Servicios activos y precios |
| `GET` | `/api/public/shop-status/{barber_id}` | Estado comercial del barbero |
| `GET` | `/api/public/availability` | Slots libres para barbero, servicio y fecha |

### Citas

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/public/appointments` | Crea una cita con validación transaccional |
| `POST` | `/api/public/appointments/lookup` | Cuerpo `{ "access_code": "SB-..." }` |
| `POST` | `/api/public/appointments/history` | Devuelve solo la cita autorizada por ese código; no desbloquea otras reservas por teléfono |
| `PATCH` | `/api/public/appointments/{appointment_id}/cancel` | Cancela una cita |
| `PATCH` | `/api/public/appointments/{appointment_id}/reschedule` | Reprograma una cita |

No existe búsqueda pública solo por teléfono ni por código en el path/query.
Cancelación y reprogramación exigen `access_code` en el JSON, incluso en citas antiguas.
Las consultas de reservas devuelven `Cache-Control: no-store`.

### Participación pública

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/public/waitlist` | Añade un cliente a lista de espera |
| `GET` | `/api/public/reviews` | Devuelve reseñas aprobadas |
| `POST` | `/api/public/reviews` | Registra una reseña pendiente |
| `POST` | `/api/public/feedback` | Guarda feedback de una cita |

## Autenticación administrativa

El navegador usa `/api/backend/admin/*`, un proxy del mismo origen en Vercel.
El login lleva `X-Session-Mode: cookie` y un `Origin` permitido. El JWT queda en
una cookie HttpOnly, Secure y SameSite=Strict en producción; el JSON devuelve
`token: "cookie"` y `csrf_token`. Las escrituras posteriores necesitan
`X-CSRF-Token` y el mismo `Origin`. JavaScript no guarda ni lee el JWT.

Los clientes de API que no solicitan el modo cookie conservan el contrato Bearer:

```http
Authorization: Bearer <token>
```

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/admin/login` | Inicia sesión como `sebas` o `gabriel` |
| `POST` | `/api/admin/logout` | Invalida las sesiones del barbero y elimina la cookie |
| `POST` | `/api/admin/reset-password` | Recupera con código maestro |
| `POST` | `/api/admin/change-password` | Cambia la contraseña autenticada |
| `GET` | `/api/admin/me` | Devuelve el perfil de sesión |
| `GET` | `/api/admin/dashboard` | Resumen operativo del día |
| `GET` | `/api/admin/stats` | Métricas y reportes agregados |
| `GET` | `/api/admin/appointments` | Agenda filtrada por barbero |
| `POST` | `/api/admin/appointments` | Cita manual; mismo esquema e idempotencia que la reserva pública, exige `barber_id` del JWT (403 si difiere) |
| `PATCH` | `/api/admin/appointments/{id}/status` | Actualiza estado |
| `PATCH` | `/api/admin/appointments/{id}/reschedule` | Reprograma desde el panel |
| `POST` | `/api/admin/blocks` | Bloquea fecha u horario |
| `POST` | `/api/admin/blocks/preview` | Revisa citas activas propias que se solapan con un bloqueo; no modifica datos |
| `GET` | `/api/admin/blocks` | Lista bloqueos propios |
| `GET` | `/api/admin/business-hours` | Consulta horarios por día |
| `PUT` | `/api/admin/business-hours/{weekday}` | Actualiza horario |
| `GET` | `/api/admin/clients` | CRM e historial propios |
| `GET` | `/api/admin/audit-logs` | Bitácora de operaciones propias |
| `GET` | `/api/admin/security-status` | Estado real de RLS y privilegios del rol PostgreSQL; requiere sesión |

La revisión de bloqueos recibe `start_date`, `end_date`, `all_day`, y para un
intervalo horario `start_min` y `end_min`. Devuelve `total` y hasta 50 elementos
en `appointments`. Admite como máximo 366 días entre las fechas extremas; los
intervalos de horas se limitan a un mismo día. Es una vista previa, no una
reserva del intervalo: la operación de creación realiza la validación final.

## Administración de contenido y operación

Estas rutas requieren JWT y respetan el aislamiento por barbero:

```text
GET/PATCH         /api/admin/settings
GET/POST/DELETE   /api/admin/business-breaks
PATCH/POST        /api/admin/client-profiles
GET/PATCH         /api/admin/reviews
GET/POST/PATCH/DELETE /api/admin/gallery
GET/POST/PATCH/DELETE /api/admin/promotions
GET/POST/DELETE   /api/admin/expenses
GET/POST          /api/admin/cash-closes
GET               /api/admin/notifications
GET               /api/admin/operations-metrics
GET               /api/admin/operations-overview
GET               /api/admin/backup
GET/PATCH         /api/admin/waitlist
```

## Tareas internas

Las tareas no usan JWT de usuario. Requieren:

```http
X-Task-Token: <valor de REMINDER_TASK_TOKEN>
```

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/tasks/reminders` | Envía recordatorios pendientes |
| `POST` | `/api/tasks/retention` | Ejecuta limpieza por retención |

Estas rutas deben invocarse desde un cron privado y nunca desde el frontend.
