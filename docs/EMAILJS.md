# EmailJS (integración anterior)

El backend mantiene compatibilidad temporal con EmailJS mediante
`EMAIL_PROVIDER=emailjs`. La migración se activa al configurar en Render
`EMAIL_PROVIDER=brevo` y las variables requeridas de Brevo.

Sigue [`BREVO.md`](BREVO.md) para crear las plantillas, configurar Render,
mantener la API key privada y retirar EmailJS después de validar el cambio.
Nunca pongas claves ni IDs del proveedor en Vercel o variables `VITE_*`.

`docs/emailjs-template-cliente.html` se conserva como referencia histórica.
Las plantillas actuales son `docs/brevo-template-cliente.html` y
`docs/brevo-template-barbero.html`.
