# Correo transaccional con Brevo

El backend de Render es el único componente que envía correos. Vercel no debe
contener la API key ni IDs de plantillas. Las reservas, recordatorios de 24 h,
cancelaciones, reprogramaciones, lista de espera y avisos al barbero siguen usando
`NotificationDelivery` para deduplicación, reintentos y control de cuota.

## 1. Crear las plantillas

En Brevo, abre **Transactional → Email → Templates** y crea dos plantillas
transaccionales activas:

1. **Sebas Barber · Cliente**: copia todo el contenido de
   [`brevo-template-cliente.html`](brevo-template-cliente.html).
2. **Sebas Barber · Agenda**: copia todo el contenido de
   [`brevo-template-barbero.html`](brevo-template-barbero.html).

Selecciona un remitente registrado en Brevo y define asuntos como `Tu cita en
Sebas Barber` y `Nueva actividad · Sebas Barber`. Guarda y activa las plantillas.
Usa sus IDs numéricos, no los nombres ni los IDs de EmailJS.

## 2. Remitente y dominio

Registra y verifica el remitente en **Settings → Senders, Domains & Dedicated
IPs → Senders**. `BREVO_SENDER_EMAIL` debe ser exactamente el remitente aceptado
por Brevo. Para buena entrega y evitar que Brevo reemplace el remitente, usa una
dirección bajo un dominio que tú controles y autentícalo con los registros DNS
que Brevo te indique. `@gmail.com` no es un dominio autenticable; la web
`sebasbarber.vercel.app` tampoco es un dominio propio para verificar por DNS.
Brevo puede permitir pruebas con remitentes verificados, pero la autenticación y
entrega a Gmail/Outlook no quedan garantizadas. [Reglas oficiales de
autenticación](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC).

## 3. Variables en Render

En **Render → servicio backend → Environment**, añade o cambia:

| Variable | Valor |
| --- | --- |
| `EMAIL_PROVIDER` | `brevo` |
| `BREVO_API_KEY` | API key transaccional; secreto, solo Render |
| `BREVO_TEMPLATE_CLIENTE` | ID numérico de la plantilla cliente |
| `BREVO_TEMPLATE_BARBERO` | ID numérico de la plantilla barbero |
| `BREVO_SENDER_EMAIL` | Remitente registrado/verificado en Brevo |
| `BREVO_SENDER_NAME` | `Sebas Barber` |
| `OWNER_EMAIL` | Correo real que recibe avisos de Sebastián |
| `GABRIEL_EMAIL` | Correo real de Gabriel; configúralo si recibirá avisos |
| `EMAIL_MONTHLY_LIMIT` | Conserva `180` como tope propio o ajústalo conscientemente |

También se aceptan `SENDER_EMAIL`, `TEMPLATE_ID_CLIENTE` y `TEMPLATE_ID_BARBERO`
como alternativas de `BREVO_SENDER_EMAIL`, `BREVO_TEMPLATE_CLIENTE` y
`BREVO_TEMPLATE_BARBERO`. No necesitas duplicarlos: si ambos nombres tienen
valor, se utiliza el que empieza con `BREVO_`. `EMAIL_PROVIDER=brevo` selecciona
explícitamente el proveedor; si se omite y existe `BREVO_API_KEY`, se selecciona
Brevo automáticamente.

Conserva las demás variables actuales de Render, en especial `DATABASE_URL`,
`SECRET_KEY`, `FRONTEND_URL`, Calendar, `REMINDERS_ENABLED`,
`REMINDER_LEAD_HOURS=24`, `REMINDER_TASK_TOKEN` y las de seguridad.
`EMAIL_MONTHLY_LIMIT` es un máximo mensual interno, no el límite diario de Brevo.
Cada correo al cliente, al barbero y cada recordatorio cuenta como un envío aparte.

El backend usa `OWNER_EMAIL` para la cuenta de Sebastián y `GABRIEL_EMAIL` para
Gabriel; revisa que sean direcciones correctas. Para otros perfiles se usa el
correo guardado en su ficha.

## 4. Variables en Vercel

**No agregues variables Brevo a Vercel.** Mantén `VITE_API_URL`, `VITE_SITE_URL`
y `EDGE_CONFIG`. El frontend llama a Render y solo el backend llama a Brevo.

Si quedaron `VITE_EMAILJS_*` o `VITE_BARBERO_EMAIL`, elimínalas de Vercel. Si
EmailJS sigue activo en producción, conserva sus variables de Render como
reversa. Tras validar Brevo, puedes quitar de Render `EMAILJS_SERVICE_ID`,
`EMAILJS_TEMPLATE_CLIENTE`, `EMAILJS_TEMPLATE_BARBERO`, `EMAILJS_PUBLIC_KEY` y
`EMAILJS_PRIVATE_KEY`.

## 5. Activación y prueba

1. Completa y activa las dos plantillas; copia sus IDs numéricos.
2. Añade las variables Brevo a Render. No cambies Vercel.
3. Render reiniciará el backend con `EMAIL_PROVIDER=brevo`.
4. Revisa `/health/ready` y los logs; no deben mostrar la API key.
5. Haz una reserva de prueba con un correo tuyo. Comprueba el correo del cliente,
   el aviso al barbero y los botones para administrar, Google Maps y Waze.
6. Confirma la entrega en Brevo y revisa spam si no llega.
7. Cuando todo esté validado, elimina las variables EmailJS antiguas de Render.

Las entregas antiguas que sigan pendientes se asignan a la plantilla Brevo de
cliente o barbero según su tipo/destinatario. Las ya enviadas o marcadas
`uncertain` no se reenvían automáticamente.

El mensaje del barbero abre `/admin` y no contiene el código privado del cliente.
Los enlaces de ubicación se actualizan también en entregas pendientes antiguas.
Las variables se envían como texto, sin escapar HTML dos veces: Brevo aplica su
escape predeterminado. No añadas `|safe` ni desactives `autoescape` en plantillas.

Los logs `Brevo: envío aceptado` significan que Brevo aceptó la solicitud, no que
el destinatario la recibió. Revisa la entrega final en el historial transaccional
de Brevo. Los errores muestran el estado HTTP y un código seguro, nunca la API
key ni las direcciones de los clientes. Un resultado ambiguo queda `uncertain`
para evitar consumir cuota con un correo duplicado.

La API utiliza `POST /v3/smtp/email`, autenticación `api-key`, variables
`{{params.nombre}}` e idempotencia por entrega. Consulta la
[referencia oficial](https://developers.brevo.com/reference/send-transac-email).
El plan Free indica 300 envíos al día; este proyecto mantiene además su propio
tope mensual interno y no amplía automáticamente el valor actual de 180.
[Límites oficiales del plan Free](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan).
