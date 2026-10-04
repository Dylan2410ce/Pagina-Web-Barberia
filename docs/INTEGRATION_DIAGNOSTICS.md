# Diagnóstico de integraciones

## Google Calendar

Cada barbero usa el calendario guardado en su perfil. Las lecturas y escrituras
usan `America/Costa_Rica`; los timestamps incluyen segundos y el desplazamiento
`-06:00`. Una fecha sin zona horaria se rechaza antes de enviarse.

En el panel privado, abre **Seguridad → Conexión de tu calendario → Comprobar
conexión**. Esta acción consulta Google sin crear ni cambiar eventos. El endpoint
`GET /api/admin/integrations/calendar` exige el JWT y consulta únicamente el
calendario del barbero autenticado. Verifica permiso de lectura; la escritura se
valida al guardar una cita. `/health/calendar` comprueba solo configuración local,
no acredita permisos externos.

Variables de Render que debes conservar:

- `CALENDAR_ENABLED=true`, `CALENDAR_REQUIRED=true`.
- `GOOGLE_CALENDAR_SEBASTIAN_ID` y `GOOGLE_CALENDAR_GABRIEL_ID`.
- `GOOGLE_CREDENTIALS_JSON`: JSON completo de la cuenta de servicio, solo en
  Render. También se admiten un Secret File y las alternativas ya documentadas.

En cada calendario, comparte la agenda con el `client_email` del JSON y el permiso
**Hacer cambios en eventos**. Activa Google Calendar API en el proyecto de esa
cuenta de servicio. No es necesario OAuth interactivo para calendarios compartidos
con una cuenta de servicio.

Los logs muestran estado HTTP, tipo de excepción y motivos reconocidos, sin el
cuerpo original ni datos personales:

| Estado | Comprobación |
| --- | --- |
| 400 | Datos del evento o configuración de la solicitud |
| 401 | Credenciales válidas y cuenta de servicio activa |
| 403 | Permiso de edición, API habilitada o cuota temporal |
| 404 | ID correcto y calendario compartido con la cuenta de servicio |
| 429 | Límite temporal de Google; esperar antes de volver a intentar |

Las conexiones HTTP tienen timeout de 10 segundos y reintentos acotados. Los
eventos tienen un ID estable por cita y horario: un conflicto de inserción o una
respuesta perdida se verifica antes de crear otro evento. La eliminación de un
evento ya eliminado (404/410) se considera completada. No se interpreta una falla
de Calendar como disponibilidad libre cuando `CALENDAR_REQUIRED=true`.

## Brevo

Consulta [configuración y plantillas](BREVO.md). El backend es el único emisor;
Vercel no requiere nuevas variables. Las reservas se guardan independientemente
del despacho de correos, que usa una cola persistente con deduplicación y cuota.

No se puede certificar la entrega real con pruebas simuladas: requiere una API
key válida, remitente verificado, plantillas activas y la confirmación en Brevo.

## Base de datos y despliegue

Esta actualización no cambia el esquema. La revisión vigente es `20260924_03`.
Render ejecuta `alembic upgrade head` al iniciar, antes de Uvicorn. No uses
`create_all` ni borres tablas en producción.

`/health/ready` verifica conectividad y revisión de Alembic; `/health` devuelve el
SHA desplegado. Una respuesta saludable de PostgreSQL no acredita el estado de
Google Calendar ni la entrega de correo.

Se verificó la cadena de migraciones en SQLite desechable y su repetición sin
cambios. Las pruebas transaccionales específicas de PostgreSQL se ejecutan en CI
contra su servicio PostgreSQL desechable, nunca contra Neon de producción.
