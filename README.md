# Sebas Barber

Proyecto simple:

- Backend: FastAPI + SQLAlchemy + Pydantic + PostgreSQL Neon.
- Frontend: React + Vite + HTML/CSS/JS.
- Deploy: Render + Netlify.

## Estructura

```txt
sebas-barber/
├─ backend/
│  ├─ app/
│  │  ├─ controllers/
│  │  ├─ services/
│  │  ├─ repositories/
│  │  ├─ models.py
│  │  ├─ schemas.py
│  │  ├─ database.py
│  │  ├─ config.py
│  │  └─ main.py
│  └─ requirements.txt
├─ frontend/
│  ├─ public/
│  ├─ src/
│  ├─ netlify.toml
│  └─ package.json
└─ render.yaml
```

## Admin

Usuarios iniciales:

```txt
sebas
gabriel
dana
```

Password inicial: el valor que pongas en Render como `ADMIN_DEFAULT_PASSWORD`.

## Variables en Render

```txt
DATABASE_URL=tu_url_de_neon
FRONTEND_URL=https://barberiasebas.netlify.app
ADMIN_DEFAULT_PASSWORD=tu_password_admin
SECRET_KEY=una_clave_larga
```

## Variable en Netlify

```txt
VITE_API_URL=https://tu-api-de-render.onrender.com
```

