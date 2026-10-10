# Gestión del equipo

## Acceso y operación

Sebastián (`sebas`) encuentra **Equipo** en el grupo **Negocio** del panel. Puede añadir un perfil con nombre, teléfono, usuario y contraseña inicial, editar su presentación pública y seleccionar agenda local o Google Calendar. La contraseña se almacena con bcrypt y nunca se devuelve en las respuestas. El usuario de acceso permanece inmutable.

Cada nuevo perfil recibe un horario inicial de martes a sábado, con apertura, cierre y almuerzo tomados de la configuración existente. El barbero modifica su horario desde su propia sesión. Los servicios y precios son compartidos; la autorización de catálogo sigue reservada al propietario.

El correo guardado en el perfil es el destinatario de sus avisos y tiene prioridad sobre los valores iniciales de Render. Los perfiles nuevos sin correo no reciben notificaciones administrativas; no se redirigen a otro barbero. Las plantillas y el proveedor existentes se reutilizan sin variables adicionales.

**Retirar** es una baja lógica: oculta el perfil en las nuevas reservas, invalida sus sesiones y conserva citas, clientes, reportes y actividad. No borra eventos externos. Se rechaza si existen citas pendientes o confirmadas que todavía no han terminado. El barbero debe resolverlas desde su agenda antes del retiro. **Reactivar** recupera el perfil y sus horarios anteriores; requiere credenciales inicializadas.

La gestión de perfiles no otorga al propietario acceso a citas, clientes, caja o exportaciones de los otros barberos. Los endpoints de agenda siguen delimitados por el JWT.

## Google Calendar y fotos

Un perfil nuevo funciona con agenda local sin variables adicionales. Para sincronizarlo, compartir previamente un calendario propio con la misma cuenta de servicio y activar Calendar en el editor, indicando su ID. Las credenciales de Google permanecen en Render. No reutilizar el calendario de otro barbero: una restricción única parcial impide compartir un ID entre perfiles activos sincronizados. Cambiar la integración se rechaza mientras haya citas pendientes, para evitar dejar eventos en el calendario anterior.

Las fotos pueden usar una ruta pública bajo `/assets/` o un enlace HTTPS de Cloudinary. No se admiten esquemas ejecutables, rutas con navegación `..` ni hosts arbitrarios. La política CSP existente permite Cloudinary. Sin foto se muestran iniciales. Las imágenes originales de Sebastián y Gabriel conservan sus rutas bajo `frontend/public/assets/fotosbarberias/`.

## API y capas

Todas las rutas requieren sesión autenticada y `username=sebas` verificado en el
servidor. El navegador usa cookie HttpOnly a través del proxy de Vercel, con
origen y token anti-CSRF en escrituras. Clientes de API pueden usar
`Authorization: Bearer <JWT>`. Tras verificar al propietario, estas operaciones
usan contexto de servicio para administrar perfiles, sin abrir las agendas ajenas:

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/admin/team` | Perfiles activos y retirados, sin claves ni datos de citas |
| POST | `/api/admin/team` | Alta con contraseña inicial; 201 |
| PUT | `/api/admin/team/{id}` | Reemplaza los campos editables del perfil |
| DELETE | `/api/admin/team/{id}` | Retiro lógico reversible |
| POST | `/api/admin/team/{id}/activate` | Reactivación |

`schemas_team.py` valida los DTO; `team_controller.py` adapta HTTP; `team_service.py` aplica permisos, transacciones y auditoría; `BarberRepository` encapsula consultas. El retiro y la creación/reprogramación de citas comparten un bloqueo de fila del perfil, seguido del bloqueo de agenda diario existente. PostgreSQL resuelve las carreras, no el estado del frontend.

El límite persistente de escrituras del equipo es 20 solicitudes por 10 minutos por IP, además del límite general. Crear o editar perfiles no inicia correos ni reservas.

## Migración y verificación

Alembic `20261004_01` añade `photo_url`, asigna las fotos existentes y crea `uq_barbers_active_calendar`. Render ya ejecuta `alembic upgrade head` antes de Uvicorn. No agregar variables nuevas a Vercel ni Render.

El seed configura los perfiles iniciales al crearlos, sin restaurar nombres, calendarios ni actividad después de una edición. Tampoco desactiva perfiles nuevos al reiniciarse.

Las pruebas cubren permisos, claves hasheadas, usuarios/calendarios duplicados, altas visibles en la reserva, conservación del historial, retiro bloqueado por citas futuras y persistencia tras el seed. La vista `scripts/preview_local.py` incluye un tercer perfil ficticio para revisar el layout sin tocar producción.
