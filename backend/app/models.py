import enum

from sqlalchemy import Column, DateTime, Enum, Integer, Numeric, String, func

from .database import Base


class EstadoAnticipo(str, enum.Enum):
    PENDIENTE = "pendiente"
    APROBADO = "aprobado"
    RECHAZADO = "rechazado"


class Anticipo(Base):
    __tablename__ = "anticipos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    cedula = Column(String, nullable=False, index=True)
    centro_costo = Column(String, nullable=False)
    obra = Column(String, nullable=False)
    valor = Column(Numeric(14, 2), nullable=False)
    director_autoriza = Column(String, nullable=False)
    justificacion = Column(String, nullable=False)
    estado = Column(
        Enum(EstadoAnticipo), nullable=False, default=EstadoAnticipo.PENDIENTE
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
