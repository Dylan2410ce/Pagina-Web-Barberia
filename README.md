# Sebas Barber

Aplicación de reservas y operación para una barbería con agendas separadas
por barbero, administración protegida, disponibilidad sincronizada con
Google Calendar, PostgreSQL y frontend React.

## Estado del sistema

- Frontend: React 19, Vite, CSS3, Tailwind CSS y Lucide React.
- Backend: FastAPI, Pydantic v2 y SQLAlchemy asíncrono.
- Persistencia: PostgreSQL, recomendado en Neon.
- Calendario: Google Calendar en `America/Costa_Rica`.
- Correo: EmailJS para confirmaciones, avisos y recordatorios.
- Despliegue: frontend en Vercel y API en Render.
- Operación: PWA, modo mantenimiento, CRM, lista de espera, reportes y
  auditoría.

La aplicación admite los perfiles `sebas` y `gabriel`. Cada sesión
administrativa queda limitada al barbero autenticado; la API aplica este
aislamiento en el servidor.

## Documentación

| Documento | Contenido |
| --- | --- |
| [Arquitectura](docs/ARCHITECTURE.md) | Capas, módulos, flujos y decisiones técnicas |
| [API](docs/API.md) | Endpoints, autenticación, errores y contratos |
| [Operación](docs/OPERATIONS.md) | Variables, despliegues, migraciones y runbooks |
| [EmailJS](docs/EMAILJS.md) | Templates, variables y diagnóstico de correos |
| [Contribución](CONTRIBUTING.md) | Flujo de trabajo para mantenimiento |

## Estructura

```text
sebas-barber/
├── backend/
│   ├── app/
│   │   ├── controllers/       # Casos de uso y endpoints de dominio
│   │   ├── repositories/      # Consultas y acceso a datos reutilizable
│   │   ├── routers/           # Rutas públicas de reservas
│   │   ├── services/          # Integraciones y reglas de negocio
│   │   ├── config.py          # Configuración desde variables de entorno
│   │   ├── database.py        # Engine y sesiones SQLAlchemy
│   │   ├── main.py            # Aplicación FastAPI y middleware
│   │   ├── models.py          # Entidades SQLAlchemy
│   │   └── schemas.py         # DTO y validación Pydantic
│   ├── alembic/               # Migraciones de base de datos
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── api/site-status.js     # Function de Vercel para Edge Config
│   ├── public/                # Imágenes, PWA y assets públicos
│   ├── src/
│   │   ├── api/               # Cliente HTTP
│   │   ├── components/        # UI pública y administración
│   │   ├── hooks/             # Estado y comportamiento reutilizable
│   │   ├── services/          # EmailJS y servicios del cliente
│   │   ├── utils/             # Fechas, CSV, almacenamiento y formatos
│   │   ├── App.jsx
│   │   └── styles.css
│   ├── package.json
│   └── vercel.json
├── docs/
├── .env.example
├── render.yaml
└── netlify.toml
```

## Inicio local

### Backend

Requisitos: Python 3.12+, PostgreSQL accesible y una terminal desde la raíz.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Configura las variables del backend tomando `.env.example` como referencia.
El backend lee las variables del entorno del proceso; no se debe subir un
archivo `.env` al repositorio.

```powershell
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

La API queda disponible en `http://localhost:8000`; FastAPI publica Swagger
en `/docs` y ReDoc en `/redoc`.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Por defecto Vite utiliza `http://localhost:5173`. Configura
`VITE_API_URL=http://localhost:8000` para conectar con la API local.

## Verificación

```powershell
cd frontend
npm test -- --run
npm run build

cd ../backend
python -m pytest -q
```

Antes de abrir un pull request ejecuta también `git diff --check`.

## Despliegue resumido

Render debe apuntar a `backend`:

```text
Build: pip install -r requirements.txt
Start: alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
Health check: /health
```

Vercel debe apuntar a `frontend` con preset Vite:

```text
Build: npm run build
Output: dist
Install: npm install
```

La lista completa de variables, migraciones, cron jobs y comprobaciones está
en [Operación](docs/OPERATIONS.md).

## Seguridad y datos sensibles

Las claves de PostgreSQL, JWT, Google Calendar, EmailJS privado, Cloudinary y
las credenciales de tareas solo deben existir en Render o en el proveedor
correspondiente. Las variables `VITE_*` forman parte del bundle público y solo
pueden contener valores diseñados para el navegador, como la clave pública de
EmailJS.

El archivo `.env.example` contiene nombres y valores de ejemplo, nunca
credenciales reales. Las credenciales de Google tampoco se almacenan como
JSON dentro del repositorio.

## Licencia y mantenimiento

Proyecto privado de Sebas Barber. Los cambios de negocio, esquema, seguridad
y despliegue deben documentarse junto con la modificación correspondiente.
