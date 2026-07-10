# Sebas Barber

App de barberia para Sebastian.

- Frontend: React + CSS + Vite, deploy en Netlify.
- Backend: FastAPI + SQLAlchemy + Pydantic + PostgreSQL Neon, deploy en Render.
- Agenda: PostgreSQL + Google Calendar API como fuente externa de disponibilidad.

## Estructura

```txt
sebas-barber/
|-- backend/
|   |-- app/
|   |   |-- controllers/
|   |   |-- repositories/
|   |   |-- services/
|   |   |-- config.py
|   |   |-- database.py
|   |   |-- main.py
|   |   |-- models.py
|   |   `-- schemas.py
|   |-- .python-version
|   `-- requirements.txt
|-- frontend/
|   |-- src/
|   |   |-- api/
|   |   |-- components/
|   |   |-- pages/
|   |   |-- utils/
|   |   |-- main.js
|   |   `-- styles.css
|   |-- index.html
|   |-- netlify.toml
|   `-- package.json
`-- render.yaml
```

## Render

Root directory:

```txt
backend
```

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Variables necesarias:

```txt
PYTHON_VERSION=3.12.11
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST/neondb?sslmode=require
FRONTEND_URL=https://sebasbarber.netlify.app
SECRET_KEY=clave_larga
ADMIN_DEFAULT_PASSWORD=clave_inicial
MASTER_RESET_CODE=SBs7LVAiZawpHfA1fgH2czClGt2iDVjU6xmOYJC8hoCK9wBv
GOOGLE_CALENDAR_ID=sebasbarberg2021@gmail.com
CALENDAR_ENABLED=true
CALENDAR_REQUIRED=true
APPOINTMENT_BUFFER_MIN=0
GOOGLE_CREDENTIALS_JSON=contenido_completo_del_json
EMAIL_PROVIDER=emailjs
NOTIFY_EMAILS_ENABLED=false
```

No subas el JSON al repo. Tambien podes cargarlo en Render como Secret File con cualquiera de estos nombres:

```txt
barberiasebas-65af4656c417.json
google-credentials.json
google-calendar.json
service-account.json
```

Render lo monta en `/etc/secrets` y la API lo detecta sola. En Google Calendar, comparti el calendario `sebasbarberg2021@gmail.com` con el `client_email` del service account y dale permisos para modificar eventos.

Diagnostico despues del deploy:

```txt
https://pagina-web-barberia.onrender.com/health/calendar
```

## Netlify

Base directory:

```txt
frontend
```

Build command:

```bash
npm run build
```

Publish directory:

```txt
dist
```

Variable:

```txt
VITE_API_URL=https://pagina-web-barberia.onrender.com
VITE_EMAILJS_PUBLIC_KEY=public_key_de_emailjs
VITE_EMAILJS_SERVICE_ID=service_o9hd76x
VITE_EMAILJS_TEMPLATE_CLIENTE=template_t0wm7yn
VITE_EMAILJS_TEMPLATE_BARBERO=template_4zjh1wk
VITE_BARBERO_EMAIL=sebasbarberg2021@gmail.com
```

## Admin

Usuario inicial:

```txt
sebas
```

La clave inicial sale de `ADMIN_DEFAULT_PASSWORD`. Si se olvida, usar `MASTER_RESET_CODE` desde la pantalla de recuperacion.
