import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from .database import Base


class EstadoAnticipo(str, enum.Enum):
    PENDIENTE = "pendiente"
    APROBADO = "aprobado"
    RECHAZADO = "rechazado"
    EN_AUTORIZACION_TOPE = "en_autorizacion_tope"


class Anticipo(Base):
    __tablename__ = "anticipos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    cedula = Column(String, nullable=False, index=True)
    cargo = Column(String, nullable=True, default="")
    empresa = Column(String, nullable=True, default="")
    email_solicitante = Column(String, nullable=True, default="")
    centro_costo = Column(String, nullable=False)
    obra = Column(String, nullable=False)
    valor = Column(Numeric(14, 2), nullable=False)
    director_autoriza = Column(String, nullable=False)
    motivo_tipo = Column(String, nullable=False, default="compras")
    motivo_detalle = Column(String, nullable=True, default="")
    obra_destino = Column(String, nullable=True, default="")
    transporte_otro = Column(Boolean, default=False)
    justificacion = Column(String, nullable=True, default="")
    firma = Column(Text, nullable=True)
    estado = Column(
        Enum(EstadoAnticipo), nullable=False, default=EstadoAnticipo.PENDIENTE
    )
    flujo_id = Column(Integer, nullable=True)
    flujo_nombre = Column(String, nullable=True, default="")
    paso_actual = Column(Integer, nullable=False, default=1)
    total_pasos = Column(Integer, nullable=False, default=1)
    legalizado = Column(Boolean, nullable=False, default=False)
    monto_legalizado = Column(Numeric(14, 2), nullable=True, default=0)
    fecha_legalizacion = Column(DateTime(timezone=True), nullable=True)
    legalizado_por = Column(String, nullable=True, default="")
    observaciones_legalizacion = Column(Text, nullable=True, default="")

    # Campos de Control de Tope y Sobretope
    supera_tope = Column(Boolean, default=False)
    monto_tope_aplicado = Column(Numeric(14, 2), nullable=True, default=1500000)
    autorizador_tope_nombre = Column(String, nullable=True, default="")
    autorizador_tope_cargo = Column(String, nullable=True, default="")
    autorizador_tope_email = Column(String, nullable=True, default="")
    autorizado_tope = Column(Boolean, nullable=True, default=None)
    fecha_autorizacion_tope = Column(DateTime(timezone=True), nullable=True)
    motivo_rechazo_tope = Column(Text, nullable=True, default="")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    progreso_pasos = relationship(
        "AnticipoPasoProgreso",
        back_populates="anticipo",
        cascade="all, delete-orphan",
        order_by="AnticipoPasoProgreso.orden",
    )


class AnticipoPasoProgreso(Base):
    __tablename__ = "anticipos_pasos_progreso"

    id = Column(Integer, primary_key=True, index=True)
    anticipo_id = Column(Integer, ForeignKey("anticipos.id", ondelete="CASCADE"), nullable=False)
    orden = Column(Integer, nullable=False, default=1)
    nombre_aprobador = Column(String, nullable=False)
    cargo_aprobador = Column(String, nullable=True, default="")
    cedula_aprobador = Column(String, nullable=True, default="")
    email_aprobador = Column(String, nullable=True, default="")
    rol_nivel = Column(String, nullable=True, default="Aprobador")
    es_dinamico = Column(Boolean, default=False)
    estado = Column(String, nullable=False, default="en_espera")  # en_espera, pendiente, aprobado, rechazado
    fecha_decision = Column(DateTime(timezone=True), nullable=True)
    comentario = Column(Text, nullable=True, default="")
    aprobado_por_nombre = Column(String, nullable=True, default="")
    aprobado_por_email = Column(String, nullable=True, default="")
    aprobadores_opcionales = Column(Text, nullable=True, default="[]")

    anticipo = relationship("Anticipo", back_populates="progreso_pasos")


class FlujoAprobacion(Base):
    __tablename__ = "flujos_aprobacion"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    descripcion = Column(String, nullable=True, default="")
    tipo_flujo = Column(String, nullable=False, default="residente") # residente, director, administrativo, directivo_area, general
    notificar_a_nombre = Column(String, nullable=True, default="")
    notificar_a_cargo = Column(String, nullable=True, default="")
    notificar_a_email = Column(String, nullable=True, default="")
    cargos_asociados = Column(Text, nullable=True, default="[]")  # JSON list of cargo strings
    aplica_a_otros_cargos = Column(Boolean, default=False)  # Incluye todos los demás cargos sin flujo específico
    es_predeterminado = Column(Boolean, default=False)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    pasos = relationship(
        "PasoAprobacion",
        back_populates="flujo",
        cascade="all, delete-orphan",
        order_by="PasoAprobacion.orden",
    )


class PasoAprobacion(Base):
    __tablename__ = "pasos_aprobacion"

    id = Column(Integer, primary_key=True, index=True)
    flujo_id = Column(Integer, ForeignKey("flujos_aprobacion.id", ondelete="CASCADE"), nullable=False)
    orden = Column(Integer, nullable=False, default=1)
    nombre_aprobador = Column(String, nullable=False)
    cargo_aprobador = Column(String, nullable=True, default="")
    cedula_aprobador = Column(String, nullable=True, default="")
    rol_nivel = Column(String, nullable=True, default="Aprobador")
    es_dinamico_solicitud = Column(Boolean, default=False)  # True si toma a la persona elegida en la solicitud ("¿Quién autoriza?")
    aprobadores_opcionales = Column(Text, nullable=True, default="[]")

    flujo = relationship("FlujoAprobacion", back_populates="pasos")


class UsuarioRol(Base):
    __tablename__ = "usuarios_roles"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    nombre = Column(String, nullable=False, default="")
    cedula = Column(String, nullable=True, default="")
    cargo = Column(String, nullable=True, default="")
    rol = Column(String, nullable=False, default="SOLICITANTE")  # ADMINISTRADOR, APROBADOR, RECAUDO, SOLICITANTE, AUDITOR
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ConfiguracionTope(Base):
    __tablename__ = "configuracion_topes"

    id = Column(Integer, primary_key=True, index=True)
    monto_tope = Column(Numeric(14, 2), nullable=False, default=1500000)
    activo = Column(Boolean, default=True)
    descripcion = Column(String, nullable=True, default="Tope estándar para anticipos de obra")
    autorizadores = Column(Text, nullable=True, default="[]")  # JSON string: [{"nombre":"...","cargo":"...","email":"...","cedula":"..."}]
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())






