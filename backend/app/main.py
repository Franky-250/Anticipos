from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models
from .database import engine
from .routers import anticipos, maestras

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Anticipos Obras")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(anticipos.router)
app.include_router(maestras.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
