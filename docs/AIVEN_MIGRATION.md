# Migración de Neon a Aiven Free

La aplicación conserva PostgreSQL, SQLAlchemy asíncrono y Alembic. No se cambian identificadores de citas, calendarios, contraseñas, códigos de reserva ni colas de correo.

## Infraestructura gratuita

El servicio `sebas-barber` se creó en el proyecto `sebasbarberg2021-c36a`, con PostgreSQL 18 y el plan **Free**, no Developer ni un plan financiado por créditos de prueba. El plan tiene 1 CPU, 1 GB de RAM, 1 GB de almacenamiento y apagado por inactividad. No incluye alta disponibilidad ni pooling administrado. Consulta los [límites oficiales](https://aiven.io/free-postgresql-database).

El engine utiliza dos conexiones permanentes y una de desbordamiento por proceso. No aumentes los workers de Render sin revisar el límite de conexiones del servicio. TLS verifica el certificado y el hostname; nunca utilices `DATABASE_SSL=disable` en producción.

## Variables de Render

| Variable | Valor / acción |
| --- | --- |
| `DATABASE_URL` | URI privada del servicio Aiven, con usuario, contraseña, host, puerto y `defaultdb`. No pegar en Git ni documentación. |
| `DATABASE_SSL` | `require` |
| `DATABASE_CA_CERT_FILE` | `/etc/secrets/aiven-ca.pem` si se configura el CA como Secret File en Render. |
| `DATABASE_CA_CERT` | Alternativa: contenido completo PEM del certificado CA del proyecto Aiven. Configurar solo una de las dos opciones de certificado. |
| `DATABASE_MIGRATION_MODE` | `true` durante el corte; `false` cuando la conexión y los datos estén verificados. |

No modificar `SECRET_KEY`, `SECRET_KEY_PREVIOUS`, códigos de recuperación, credenciales de Calendar o Brevo. Las claves existentes permiten leer los códigos cifrados y conservar los accesos. **Vercel no necesita variables nuevas**: sigue consumiendo la misma API de Render.

## Procedimiento verificable

1. Obtener una URI **directa** de Neon y la URI de Aiven desde sus consolas. Descargar el certificado CA de Aiven. Mantener estos valores fuera de archivos versionados.
2. Instalar las herramientas oficiales `pg_dump` y `pg_restore` de PostgreSQL 18. No instalar un servidor local si solo se necesitan los binarios. Añadir su carpeta `bin` al PATH de la sesión.
3. En una sesión privada de terminal, definir `SOURCE_DATABASE_URL`, `AIVEN_DATABASE_URL` y `AIVEN_CA_CERT_FILE`. Estas variables son locales, no variables de Vercel ni de producción.
4. Desde `backend`, ejecutar `python scripts/migrate_aiven.py check`. Verifica TLS, almacenamiento y disponibilidad de `btree_gist` sin escribir datos.
5. Publicar el código compatible con Aiven en Render. Activar `DATABASE_MIGRATION_MODE=true` y esperar a que termine el despliegue. Este modo rechaza escrituras, detiene recordatorios y evita que las consultas de lectura modifiquen los contadores persistentes. La web sigue visible. No realizar cambios directos en Neon durante el corte.
6. Confirmar localmente `MIGRATION_WRITES_PAUSED=true`. Ejecutar `python scripts/migrate_aiven.py export`, luego `python scripts/migrate_aiven.py restore` y `python scripts/migrate_aiven.py verify`.
7. El respaldo usa una instantánea transaccional de PostgreSQL. La restauración se realiza en una sola transacción y exige destino vacío. Se comparan conteos y hashes de **todas** las tablas, incluyendo `alembic_version`, colas de correo y presupuestos. No se borran datos del origen.
8. Solo tras obtener `verified: true`, modificar `DATABASE_URL` y el CA en Render. Mantener el modo de migración activo. El build habitual ejecuta `alembic upgrade head`; el esquema restaurado ya conserva su revisión.
9. Verificar `/health` y `/health/ready`, el inicio de sesión de ambos barberos y disponibilidad de ambas agendas. Confirmar que `/api/public/init` devuelve los mismos IDs. No crear una cita real como prueba sin autorización.
10. Cambiar `DATABASE_MIGRATION_MODE=false`, esperar el despliegue y comprobar nuevamente la disponibilidad. Conservar Neon y el respaldo privado para recuperación; no eliminar la base anterior durante esta entrega.

## Respaldo y recuperación

`.backups/neon-to-aiven.dump` y su manifiesto están excluidos de Git. Contienen datos privados: proteger el acceso local y no subirlos a repositorios, chats o correos.

Si la verificación falla **antes** del cambio, la API continúa con Neon. Si falla después, volver a la URI y TLS anteriores con escrituras aún pausadas. Una vez que Aiven haya recibido nuevas reservas, no volver a Neon sin reconciliar esos cambios: se perderían citas nuevas.

No ejecutar `--clean`, `DROP DATABASE` ni desactivar la verificación de TLS para solucionar una restauración. El procedimiento se basa en la [migración oficial con pg_dump / pg_restore](https://aiven.io/docs/products/postgresql/howto/migrate-pg-dump-restore).
