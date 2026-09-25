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
| `POST` | `/api/public/appointments/history` | Historial autorizado con el mismo cuerpo |
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

El login devuelve un JWT. En las rutas protegidas se envía:

```http
Authorization: Bearer <token>
```

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/admin/login` | Inicia sesión como `sebas` o `gabriel` |
| `POST` | `/api/admin/reset-password` | Recupera con código maestro |
| `POST` | `/api/admin/change-password` | Cambia la contraseña autenticada |
| `GET` | `/api/admin/me` | Devuelve el perfil de sesión |
| `GET` | `/api/admin/dashboard` | Resumen operativo del día |
| `GET` | `/api/admin/stats` | Métricas y reportes agregados |
| `GET` | `/api/admin/appointments` | Agenda filtrada por barbero |
| `PATCH` | `/api/admin/appointments/{id}/status` | Actualiza estado |
| `PATCH` | `/api/admin/appointments/{id}/reschedule` | Reprograma desde el panel |
| `POST` | `/api/admin/blocks` | Bloquea fecha u horario |
| `GET` | `/api/admin/blocks` | Lista bloqueos propios |
| `GET` | `/api/admin/business-hours` | Consulta horarios por día |
| `PUT` | `/api/admin/business-hours/{weekday}` | Actualiza horario |
| `GET` | `/api/admin/clients` | CRM e historial propios |
| `GET` | `/api/admin/audit-logs` | Bitácora de operaciones propias |

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
