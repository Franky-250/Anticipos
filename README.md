# Anticipos de Obra

Aplicación para gestionar solicitudes de anticipo de obra: un solicitante registra la
información del anticipo y (próximamente) queda sujeta a un flujo de aprobaciones.

## Stack

- **Backend**: Python (FastAPI + SQLAlchemy + SQLite)
- **Frontend**: React + Vite

## Estructura del proyecto

```
backend/
  app/
    main.py            # App FastAPI, CORS, montaje de routers
    database.py         # Conexión SQLAlchemy (SQLite)
    models.py            # Modelo Anticipo
    schemas.py           # Esquemas Pydantic
    config.py            # Configuración (variables de entorno)
    cronos_client.py     # Cliente HTTP hacia la API de maestras (Cronos)
    routers/
      anticipos.py       # CRUD de solicitudes de anticipo
      maestras.py         # Proxy de empleados / directores / centros de costo
  requirements.txt
  .env.example

frontend/
  src/
    App.jsx             # Layout con router (sidebar + páginas)
    Sidebar.jsx          # Menú lateral (Dashboard, Solicitudes, Estados)
    SolicitudForm.jsx    # Formulario de solicitud de anticipo
    ListaAnticipos.jsx   # Tabla de solicitudes y su estado
    api.js               # Cliente fetch hacia el backend
    pages/
      Dashboard.jsx
      Solicitudes.jsx
      Estados.jsx
```

## Funcionalidad actual

- Formulario de solicitud de anticipo: nombre, cédula, centro de costo, obra, valor,
  director que autoriza y justificación.
- Autocompletado de **empleado** (nombre/cédula), selector de **obra** (autocompleta el
  centro de costo) y selector de **director**, alimentados desde la API de maestras
  corporativa (Cronos).
- Dashboard con totales por estado (pendiente/aprobado/rechazado) y valor total
  solicitado.
- Listado de solicitudes con su estado (pantalla "Estados").
- El flujo de aprobaciones (niveles, notificaciones, roles) está pendiente de definir.

## Integración con la API de maestras (Cronos)

El backend actúa como **proxy** hacia `https://cronos.pcmejia.com/api` para no exponer
la API key al navegador. Los endpoints propios son:

- `GET /api/maestras/empleados?q=texto` — busca empleados por nombre o cédula.
- `GET /api/maestras/directores` — lista personas con cargo "DIRECTOR...".
- `GET /api/maestras/centros` — lista de obras/centros de costo (código + nombre).

Estos datos se cachean en memoria 5 minutos para reducir la carga sobre el servicio
externo. Configura la clave en `backend/.env` (ver `backend/.env.example`):

```
CRONOS_API_URL=https://cronos.pcmejia.com/api
CRONOS_API_KEY=<clave provista>
```

> Nota: el endpoint `api/proyectos` de Cronos responde error 500 actualmente; no se usa.

## Cómo correr el proyecto en desarrollo

### Backend

```bash
cd backend
python -m venv .venv
./.venv/Scripts/activate        # Windows
pip install -r requirements.txt
cp .env.example .env             # y completa CRONOS_API_KEY
uvicorn app.main:app --reload --port 8000
```

La API queda disponible en `http://localhost:8000` (documentación interactiva en
`http://localhost:8000/docs`).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

La app queda disponible en `http://localhost:5173`.

## Próximos pasos

- Definir y construir el flujo de aprobaciones (niveles, roles, notificaciones).
- Autenticación de usuarios.
