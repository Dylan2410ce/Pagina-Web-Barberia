# Sebas Barber

Sistema de reservas para Sebastian y Gabriel.

- Frontend: React 19, Vite, Tailwind CSS, CSS3 y Lucide.
- Backend: FastAPI, Pydantic v2 y SQLAlchemy Async.
- Base de datos: PostgreSQL en Neon.
- Calendarios: Sebastian usa PostgreSQL + Google Calendar; Gabriel usa solo PostgreSQL.

## Estructura

```txt
sebas-barber/
|-- backend/
|   |-- app/
|   |   |-- controllers/
|   |   |-- repositories/
|   |   |-- routers/
|   |   |-- services/
|   |   |-- config.py
|   |   |-- database.py
|   |   |-- main.py
|   |   |-- models.py
|   |   `-- schemas.py
|   |-- .python-version
|   `-- requirements.txt
|-- frontend/
|   |-- public/
|   |-- src/
|   |   |-- api/
|   |   |-- components/
|   |   |-- services/
|   |   |-- utils/
|   |   |-- App.jsx
|   |   |-- main.jsx
|   |   `-- styles.css
|   |-- index.html
|   |-- netlify.toml
|   `-- package.json
|-- .env.example
`-- render.yaml
```

## Render

Configuracion del servicio:

```txt
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
Health Check Path: /health
```

Variables que deben existir en Render:

```txt
PYTHON_VERSION=3.12.11
DATABASE_URL=postgresql://USUARIO:CLAVE@HOST-POOLER/neondb?sslmode=require
DATABASE_SSL=require
FRONTEND_URL=https://sebasbarber.netlify.app
SECRET_KEY=una_clave_aleatoria_larga
ADMIN_DEFAULT_PASSWORD=clave_inicial_de_sebastian
GABRIEL_DEFAULT_PASSWORD=clave_inicial_de_gabriel
MASTER_RESET_CODE=codigo_alfanumerico_largo
GOOGLE_CALENDAR_ID=sebasbarberg2021@gmail.com
GOOGLE_CREDENTIALS_JSON=contenido_completo_del_json
CALENDAR_ENABLED=true
CALENDAR_REQUIRED=true
APPOINTMENT_BUFFER_MIN=0
SERVICE_CACHE_TTL_SECONDS=300
NOTIFY_EMAILS_ENABLED=false
```

`ADMIN_PASSWORD_HASH` y `GABRIEL_PASSWORD_HASH` son alternativas opcionales a
las claves iniciales. No configures ambos mecanismos para la misma cuenta.

El JSON de Google nunca se sube al repositorio. Tambien se puede cargar como
Secret File con uno de estos nombres:

```txt
barberiasebas-65af4656c417.json
google-credentials.json
google-calendar.json
service-account.json
```

La cuenta de servicio solo modifica la agenda de Sebastian. Gabriel no llama a
Google Calendar.

Diagnostico:

```txt
https://pagina-web-barberia.onrender.com/health
https://pagina-web-barberia.onrender.com/health/calendar
```

URL exacta para cron-job.org:

```txt
https://pagina-web-barberia.onrender.com/health
```

Metodo `GET`, respuesta `{"status":"ok"}`, codigo `200`.

## Netlify

Para el deploy manual:

```bash
cd frontend
npm run build
```

Arrastra el contenido de `frontend/dist` a Netlify Drop. El frontend ya tiene
la URL publica de la API y la configuracion publica de EmailJS como valores de
respaldo, por lo que no necesita variables en Netlify para funcionar. Se pueden
sobrescribir con:

```txt
VITE_API_URL=https://pagina-web-barberia.onrender.com
VITE_EMAILJS_PUBLIC_KEY=public_key_de_emailjs
VITE_EMAILJS_SERVICE_ID=service_o9hd76x
VITE_EMAILJS_TEMPLATE_CLIENTE=template_t0wm7yn
VITE_EMAILJS_TEMPLATE_BARBERO=template_4zjh1wk
VITE_BARBERO_EMAIL=sebasbarberg2021@gmail.com
```

## Admin

```txt
Sebastian: usuario sebas
Gabriel: usuario gabriel
```

Cada token queda asociado al ID de su barbero. El panel, los bloqueos, horarios,
clientes y reportes se filtran en el servidor por ese ID. El codigo de
recuperacion configurado en `MASTER_RESET_CODE` permite cambiar cualquiera de
las dos claves desde `/admin`.
