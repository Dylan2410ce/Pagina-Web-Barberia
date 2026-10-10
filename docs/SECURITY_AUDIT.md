# Auditoría de seguridad y accesibilidad

Fecha: 10 de octubre de 2026. Alcance: código, historial Git disponible,
dependencias resueltas, pruebas y vista local con datos ficticios.
No se realizaron ataques de carga ni reservas, cambios de contraseña o envíos
de correo en producción.

## Controles implementados

| Control | Implementación |
| --- | --- |
| Sesión web | Cookie `__Host-sebas-admin`, HttpOnly, Secure, SameSite=Strict, Path=/, sin Domain, cuatro horas en producción. El JWT ya no se guarda en JavaScript. |
| CSRF | Origen exacto y cabecera X-CSRF-Token vinculada a la sesión en mutaciones con cookie. También se comprueba el origen del login. |
| Logout | Invalida las sesiones anteriores del barbero y elimina la cookie. |
| IDOR | Autorización por barbero. Un código solo permite consultar su cita, no otras reservas con el mismo teléfono. |
| Respuestas públicas | Excluyen correo interno, ajustes de sincronización e identificadores de eventos Google. |
| RLS | Migración 20261010_01: ENABLE + FORCE RLS en 14 tablas. Contexto obtenido del JWT verificado, repuesto en cada transacción. Prueba PostgreSQL con rol sin BYPASSRLS. |
| Fuerza bruta | Límites persistentes por IP y cuenta: login 10/15 minutos, recuperación 3/hora. Identificadores guardados como HMAC. |
| SQL/entradas | ORM parametrizado, Pydantic extra=forbid, rechazo de HTML y validación de formatos/tamaños. |
| Archivos | Carga autenticada, límites de bytes, MIME y firma JPEG/PNG/WebP. RequestGuard limita cuerpos y lectores concurrentes. |
| Contraseñas | bcrypt con salt y coste 12; política de 12 caracteres para claves nuevas y máximo efectivo de 72 bytes. |
| Red | CORS explícito, docs desactivadas en producción, CSP/HSTS/nosniff, anti-iframe y TLS PostgreSQL con verificación del certificado. |
| Dependencias | Actualizados FastAPI/Starlette, PyJWT, cryptography, source-map-js y undici; escaneos npm/pip/Gitleaks en CI. |
| UI | Sistema/Claro/Oscuro, colores semánticos, foco visible, controles táctiles y movimiento reducido. Revisión desde 320 px; no se promete 60 fps constantes en cualquier dispositivo. |

## Vercel, Render y cookies

Una cookie SameSite=Strict no debe depender de peticiones del navegador entre
los dominios distintos de Vercel y Render. La Function
`frontend/api/backend.js`, mediante una reescritura explícita de vercel.json,
publica solo `/api/backend/admin/*` en el
dominio del frontend. El destino procede de VITE_API_URL, nunca del visitante.
Rechaza HTTP, credenciales en la URL, rutas ajenas al admin y redirecciones.
Conserva Set-Cookie y no reenvía cabeceras IP aportadas por el visitante.
La entrada estática evita depender de la convención catch-all de Next.js en Vite.

Las consultas públicas siguen yendo directamente a Render. El proxy consume la
cuota gratuita normal de Functions; no requiere un plan de pago ni elimina los
límites del proveedor o el arranque en frío de Render. Los consumidores API con
Bearer siguen soportados. En el navegador solo se guardan un marcador y el
token anti-CSRF, no el JWT. Las sesiones antiguas requieren iniciar sesión otra vez.

## Despliegue

No hay variables nuevas obligatorias.

- Render: conservar ENVIRONMENT=production, FRONTEND_URL=https://sebasbarber.vercel.app,
  RATE_LIMIT_ENABLED=true, DATABASE_SSL=require y los secretos existentes.
- Vercel Production: conservar VITE_API_URL=https://pagina-web-barberia.onrender.com.
  La Function utiliza esa misma variable en servidor.
- Render debe ejecutar `alembic upgrade head` antes de Uvicorn; render.yaml ya lo incluye.
- En el panel: Seguridad → Estado de seguridad → Comprobar seguridad verifica el rol real.

Comandos manuales desde backend, con DATABASE_URL configurada:

```sh
python -m alembic upgrade head
python -m unittest discover -s tests -v
```

## Pendientes y límites de la verificación

### RLS en producción

Superusuarios y roles BYPASSRLS omiten las políticas incluso con FORCE RLS.
No basta con relrowsecurity=true. El endpoint autenticado
GET /api/admin/security-status comprueba también los privilegios del rol efectivo.
Si role_bypasses_rls=true, se necesita un rol de ejecución NOSUPERUSER/NOBYPASSRLS
sin DDL, separado de la cuenta de migraciones. No se cambiaron credenciales ni
roles de producción sin inspeccionar el proveedor.

Las rutas públicas y procesos internos usan contexto de servicio confiable;
las privadas, contexto del barbero. La gestión de equipo obtiene contexto de
servicio solo después de validar al propietario. RLS es una capa adicional, no
reemplaza autorización ni protege una cuenta SQL comprometida capaz de ejecutar
set_config. El navegador no accede directamente a PostgreSQL: no corresponde
publicar una clave anónima de DB.

### Cifrado de PII

Se verifica TLS en tránsito y se cifran códigos de reserva con Fernet.
**Nombres, teléfonos, correos y notas no están cifrados individualmente en las
columnas.** El cifrado de discos/copias depende del proveedor y no se certificó
con acceso a su consola. No debe anunciarse cifrado por campo como implementado.
Añadirlo requiere clave independiente, rotación, backfill reversible e índices
HMAC para búsquedas. No se transformaron irreversiblemente las citas reales.
La migración a Aiven no se da por completada solo por soportar su URL y CA.

### Secretos

Gitleaks 8.30.1 revisó todas las referencias Git locales disponibles y no detectó
secretos reales según sus reglas. El valor exacto de una contraseña ficticia de
pruebas está permitido explícitamente en .gitleaks.toml; no se excluyen archivos
de pruebas completos. Solo .env.example está versionado entre los patrones
de entorno/credenciales comprobados. Esto no garantiza ausencia de filtraciones
en otras referencias remotas, logs, copias o conversaciones. Rota las credenciales
compartidas anteriormente desde sus proveedores. No se reescribió el historial.

### Abuso y phishing

Rate limiting, honeypot, límites de cuerpo, idempotencia y control de concurrencia
reducen spam y fuerza bruta. No sustituyen protección de red contra DDoS ni
garantizan inmunidad al phishing. No se añadió CAPTCHA ni servicios de pago.
Los límites por cuenta son compartidos entre IPs; el límite IP del proxy puede
agrupar sesiones detrás del mismo punto de salida de Vercel.

La interfaz limita fotos a 4 MB para dejar margen al multipart bajo el
[límite de 4,5 MB de Vercel Functions](https://vercel.com/docs/functions/limitations).
Los respaldos/respuestas del proxy se transmiten como stream, sin cargar todo el
documento en memoria. Las herramientas de respaldo y migración usan un contexto
de servicio explícito para evitar exportaciones parciales al activar RLS.

## Repetir las pruebas

```sh
cd frontend
npm ci
npm test
npm run build
npm audit --audit-level=high
cd ../backend
python -m pip install -r requirements-test.txt
pip-audit -r requirements.txt
python -m unittest discover -s tests -v
```

RLS/concurrencia necesitan un PostgreSQL desechable en TEST_POSTGRES_URL.
Nunca uses esa variable con producción. CI provisiona PostgreSQL 16 y ejecuta
las migraciones antes de las pruebas.

Referencias: [RLS PostgreSQL](https://www.postgresql.org/docs/17/ddl-rowsecurity.html),
[CSRF OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html),
[sesiones OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
