from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import auth, models
from .database import engine, migrate_db
from .routers import anticipos, colaboradores, maestras

models.Base.metadata.create_all(bind=engine)
migrate_db()

app = FastAPI(title="Anticipos Obras")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://pandora.pcmejia.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(anticipos.router)
app.include_router(maestras.router)
app.include_router(colaboradores.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
