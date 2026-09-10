from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from .models import EstadoAnticipo


class AnticipoCreate(BaseModel):
    nombre: str = Field(min_length=1)
    cedula: str = Field(min_length=1)
    centro_costo: str = Field(min_length=1)
    obra: str = Field(min_length=1)
    valor: Decimal = Field(gt=0)
    director_autoriza: str = Field(min_length=1)
    justificacion: str = Field(min_length=1)


class AnticipoOut(AnticipoCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    estado: EstadoAnticipo
    created_at: datetime
