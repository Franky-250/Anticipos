from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/anticipos", tags=["anticipos"])


@router.post("", response_model=schemas.AnticipoOut, status_code=201)
def crear_anticipo(datos: schemas.AnticipoCreate, db: Session = Depends(get_db)):
    anticipo = models.Anticipo(**datos.model_dump())
    db.add(anticipo)
    db.commit()
    db.refresh(anticipo)
    return anticipo


@router.get("", response_model=list[schemas.AnticipoOut])
def listar_anticipos(db: Session = Depends(get_db)):
    return (
        db.query(models.Anticipo)
        .order_by(desc(models.Anticipo.created_at))
        .all()
    )


@router.get("/{anticipo_id}", response_model=schemas.AnticipoOut)
def obtener_anticipo(anticipo_id: int, db: Session = Depends(get_db)):
    anticipo = db.get(models.Anticipo, anticipo_id)
    if anticipo is None:
        raise HTTPException(status_code=404, detail="Anticipo no encontrado")
    return anticipo
