import json
import logging
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

logger = logging.getLogger("anticipos.topes")

router = APIRouter(prefix="/api/topes", tags=["topes"])


def _obtener_o_crear_configuracion_tope(db: Session) -> models.ConfiguracionTope:
    config = db.query(models.ConfiguracionTope).first()
    if not config:
        config = models.ConfiguracionTope(
            monto_tope=Decimal(1500000),
            activo=True,
            descripcion="Tope estándar para anticipos de obra ($1.500.000 COP)",
            autorizadores="[]",
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.get("/configuracion", response_model=schemas.ConfiguracionTopeOut)
def obtener_configuracion_tope(db: Session = Depends(get_db)):
    """
    Retorna la configuración actual del tope máximo estándar y los autorizadores de sobretope.
    """
    return _obtener_o_crear_configuracion_tope(db)


@router.put("/configuracion", response_model=schemas.ConfiguracionTopeOut)
def actualizar_configuracion_tope(
    payload: schemas.ConfiguracionTopeUpdate,
    db: Session = Depends(get_db),
):
    """
    Actualiza el monto tope, el estado de la regla o la lista de personas autorizadas para sobretope.
    """
    config = _obtener_o_crear_configuracion_tope(db)

    if payload.monto_tope is not None:
        if payload.monto_tope <= 0:
            raise HTTPException(status_code=400, detail="El monto tope debe ser mayor a cero.")
        config.monto_tope = payload.monto_tope

    if payload.activo is not None:
        config.activo = payload.activo

    if payload.descripcion is not None:
        config.descripcion = payload.descripcion.strip()

    if payload.autorizadores is not None:
        # Asegurar formato JSON válido
        config.autorizadores = json.dumps(payload.autorizadores, ensure_ascii=False)

    db.commit()
    db.refresh(config)
    return config
