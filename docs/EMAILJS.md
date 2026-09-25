# EmailJS

## Modelo actual

La aplicación usa EmailJS para confirmaciones al cliente, avisos al barbero,
recordatorios 24 horas antes y notificaciones de cambios o cancelaciones
cuando el flujo las activa.

El correo actual **no utiliza attachments**. La clave privada de la reserva se
envía como texto y el correo incluye botones para administrar la cita, abrir
Google Maps y abrir Waze. El QR puede mostrarse en la confirmación web, pero
no se adjunta al correo.

## Configuración de templates

En ambos templates configura:

```text
To Email: {{to_email}}
From Name: {{from_name}}
Reply To: {{reply_to}}
Subject: {{email_subject}}
```

El template visual del cliente está versionado en:

```text
docs/emailjs-template-cliente.html
```

El template del barbero puede usar como mínimo:

```text
{{email_title}}
{{email_message}}
```

No configures Variable Attachments ni uses `cid:qr_code` en el HTML.

## Variables de una notificación

| Variable | Uso |
| --- | --- |
| `{{client_name}}` | Nombre del cliente |
| `{{client_email}}` | Correo del cliente |
| `{{client_phone}}` | Teléfono del cliente |
| `{{barber_name}}` | Barbero asignado |
| `{{service_name}}` | Servicio reservado |
| `{{addons}}` | Extras sin duración adicional |
| `{{appointment_date}}` | Fecha localizada |
| `{{appointment_time}}` | Hora localizada |
| `{{duration}}` | Duración del servicio |
| `{{total_price}}` | Total en colones |
| `{{access_code}}` | Clave privada de administración |
| `{{manage_url}}` | Enlace para consultar o administrar |
| `{{maps_url}}` | Google Maps |
| `{{waze_url}}` | Waze |
| `{{location}}` | Dirección del local |
| `{{notes}}` | Notas del cliente |
| `{{security_notice}}` | Aviso de seguridad |
| `{{notification_badge}}` | Estado visible del correo |
| `{{email_title}}` | Título del mensaje |
| `{{email_message}}` | Mensaje de texto |

El template utiliza secciones condicionales para confirmación, recordatorio,
reprogramación, cancelación y lista de espera.

## Frontend y backend

El backend es el único emisor. Confirmaciones, cambios, cancelaciones y
recordatorios usan `NotificationDelivery`, con deduplicación, presupuesto y
concesión exclusiva en Neon. El navegador solo crea o modifica la cita por la API.

Frontend: no necesita variables EmailJS; elimina las antiguas `VITE_EMAILJS_*`
y `VITE_BARBERO_EMAIL` de Vercel. El próximo build ya no incluye el SDK.

Backend:

```text
EMAIL_PROVIDER=emailjs
EMAILJS_SERVICE_ID
EMAILJS_TEMPLATE_CLIENTE
EMAILJS_TEMPLATE_BARBERO
EMAILJS_PUBLIC_KEY
EMAILJS_PRIVATE_KEY
```

`EMAILJS_PRIVATE_KEY` es exclusivo del backend. Nunca debe tener prefijo
`VITE_` ni aparecer en el navegador.

## Plan gratuito y estados de entrega

- Usa los mismos dos templates; el recordatorio reutiliza el template del cliente.
- `EMAIL_MONTHLY_LIMIT=180` limita intentos acumulados por mes UTC. Ajusta al saldo
  restante antes de activar la migración; no conoce envíos históricos o de otras apps.
- `DAILY_SUMMARIES_ENABLED=false` evita resúmenes que consuman cuota.
- Habilita solicitudes desde aplicaciones no navegador en la configuración de seguridad
  de EmailJS. No envíes claves privadas al frontend.
- La lista de dominios permitidos no está incluida en el plan Free actual.
  No se considera una barrera de seguridad de esta implementación.
- `sent` significa aceptado por EmailJS, no entrega garantizada a la bandeja de entrada.
- `uncertain` requiere revisar EmailJS History: puede haberse aceptado antes de un timeout.
  No se reenvía automáticamente para evitar duplicados.
- `failed` por rechazo transitorio (429) se reintenta con espera; un rechazo permanente
  detiene los intentos. `quota_exhausted` conserva la cola sin hacer más llamadas.
- La clave viaja en JSON hacia la API. El enlace de correo usa un fragmento `#mis-citas?...`,
  que no se transmite al servidor HTTP y se retira de la barra al abrir la aplicación.
- El QR permanece en el comprobante web; no se envía como adjunto ni imagen base64.

[Planes EmailJS](https://www.emailjs.com/pricing/) ·
[API oficial de envío](https://www.emailjs.com/docs/rest-api/send/)

## Prueba manual

1. Crea una reserva de prueba con un correo controlado.
2. Confirma destinatario, fecha, hora, barbero, servicio, total y clave.
3. Prueba los enlaces de administración, Google Maps y Waze.
4. Verifica el aviso del barbero.
5. Prueba recordatorios en staging si necesitas validar el horario de 24 horas.

## Diagnóstico

- `The template doesn't exist`: revisa el ID del template.
- `The service ID is not configured`: revisa `EMAILJS_SERVICE_ID`.
- Correo sin destinatario: verifica `to_email` y el campo **To Email**.
- Variables vacías: confirma que los nombres coincidan exactamente con el
  payload.
- Correo no recibido: revisa spam, supresiones y límites de EmailJS.
- Error por attachments: elimina toda configuración de attachments y conserva
  la clave de reserva como texto.
