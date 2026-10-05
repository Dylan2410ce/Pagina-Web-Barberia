# Seguridad y operación

## Controles implementados

- JWT con identidad y versión de sesión; autorización por barbero aplicada en el servidor.
- Consultas SQLAlchemy con parámetros y validación Pydantic estricta. No construir SQL con campos enviados por clientes.
- Consultas y cambios de reservas privadas por código mediante POST. No registrar códigos, tokens, correos ni teléfonos en logs.
- Límite persistente global y por operación en PostgreSQL; las reglas de reservas, acceso y recuperación sobreviven reinicios de Render.
- Filtro local de ráfagas, acotado a 2.048 entradas. Su función es proteger la base de datos; no sustituye el límite persistente.
- Cuerpo JSON limitado a 64 KiB, lectura de uploads acotada, timeout y máximo de ocho lectores JSON / dos uploads simultáneos por proceso. El límite se aplica aun sin Content-Length.
- CORS restringido, cabeceras de seguridad, IDs de solicitud UUID y documentación de API deshabilitada en producción.
- TLS de PostgreSQL con verificación de CA y hostname, incluyendo certificados de Aiven.
- Correos enviados solo por el backend mediante la cola durable, con deduplicación, presupuesto y manejo de resultados inciertos.

## Límites y precauciones

Estos controles reducen abuso, inyecciones y exposición accidental. No garantizan inmunidad ante phishing, DDoS o cuentas comprometidas. El phishing dirigido al propietario no se resuelve con una paleta visual ni un middleware: activar autenticación multifactor en GitHub, Render, Vercel, Aiven y Google cuando esté disponible y revisar los dominios antes de iniciar sesión.

No configurar proxies de confianza como `0.0.0.0/0` ni `::/0`. La aplicación acepta X-Forwarded-For solo desde las redes de confianza y recorre la cadena desde el proxy más cercano. No iniciar Uvicorn con `--forwarded-allow-ips=*`.

Neon y Aiven deben conservar sus usuarios y certificados privados fuera de Git. Los secretos previamente publicados o compartidos en capturas deben revocarse desde sus proveedores. `VITE_*` es público por diseño: nunca colocar allí claves privadas, credenciales de base de datos o códigos de recuperación.

## Reportar un problema

Enviar un reporte privado al propietario del repositorio con ruta afectada, impacto y pasos reproducibles sin datos reales. No publicar credenciales ni información de clientes en issues públicos. Ante sospecha de compromiso, pausar escrituras, conservar evidencias privadas, revocar las credenciales afectadas y verificar las versiones desplegadas antes de reabrir la agenda.
