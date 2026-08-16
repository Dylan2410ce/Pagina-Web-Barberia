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

El frontend envía confirmaciones inmediatas desde
`frontend/src/services/emailjsService.js`. El backend utiliza su servicio de
notificaciones para recordatorios y tareas sin sesión de navegador.

Frontend:

```text
VITE_EMAILJS_PUBLIC_KEY
VITE_EMAILJS_SERVICE_ID
VITE_EMAILJS_TEMPLATE_CLIENTE
VITE_EMAILJS_TEMPLATE_BARBERO
VITE_BARBERO_EMAIL
```

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
