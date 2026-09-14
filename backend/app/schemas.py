import json
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import EstadoAnticipo


class AnticipoPasoProgresoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    anticipo_id: int
    orden: int
    nombre_aprobador: str
    cargo_aprobador: str | None = ""
    cedula_aprobador: str | None = ""
    email_aprobador: str | None = ""
    rol_nivel: str | None = "Aprobador"
    es_dinamico: bool = False
    aprobadores_opcionales: list[dict] = Field(default_factory=list)
    estado: str = "en_espera"
    fecha_decision: datetime | None = None
    comentario: str | None = ""
    aprobado_por_nombre: str | None = ""
    aprobado_por_email: str | None = ""

    @field_validator("aprobadores_opcionales", mode="before")
    @classmethod
    def parse_opcionales(cls, v):
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else []
            except Exception:
                return []
        if isinstance(v, list):
            return v
        return []


class AnticipoCreate(BaseModel):
    nombre: str = Field(min_length=1)
    cedula: str = Field(min_length=1)
    cargo: str | None = Field(default="")
    empresa: str | None = Field(default="")
    email_solicitante: str | None = Field(default="")
    centro_costo: str = Field(min_length=1)
    obra: str = Field(min_length=1)
    valor: Decimal = Field(gt=0)
    director_autoriza: str = Field(min_length=1)
    motivo_tipo: str = Field(default="compras")
    motivo_detalle: str | None = Field(default="")
    obra_destino: str | None = Field(default="")
    transporte_otro: bool = Field(default=False)
    justificacion: str | None = Field(default="")
    firma: str | None = Field(default="")
    supera_tope: bool = Field(default=False)
    autorizador_tope_nombre: str | None = Field(default="")
    autorizador_tope_cargo: str | None = Field(default="")
    autorizador_tope_email: str | None = Field(default="")


class AnticipoOut(AnticipoCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    estado: EstadoAnticipo
    flujo_id: int | None = None
    flujo_nombre: str | None = ""
    paso_actual: int = 1
    total_pasos: int = 1
    legalizado: bool = False
    monto_legalizado: Decimal | None = Decimal(0)
    fecha_legalizacion: datetime | None = None
    legalizado_por: str | None = ""
    observaciones_legalizacion: str | None = ""
    monto_tope_aplicado: Decimal | None = Decimal(1500000)
    autorizado_tope: bool | None = None
    fecha_autorizacion_tope: datetime | None = None
    motivo_rechazo_tope: str | None = ""
    created_at: datetime
    progreso_pasos: list[AnticipoPasoProgresoOut] = Field(default_factory=list)


class LegalizarAnticipoRequest(BaseModel):
    legalizado: bool = True
    monto_legalizado: Decimal | None = None
    legalizado_por: str | None = ""
    observaciones: str | None = ""


class AprobarPasoRequest(BaseModel):
    comentario: str | None = ""
    aprobador_nombre: str | None = ""
    aprobador_email: str | None = ""
    firma: str | None = ""


class RechazarPasoRequest(BaseModel):
    motivo: str = Field(min_length=1)
    aprobador_nombre: str | None = ""
    aprobador_email: str | None = ""


class AutorizarSobretopeRequest(BaseModel):
    comentario: str | None = ""
    autorizador_nombre: str | None = ""
    autorizador_email: str | None = ""


class RechazarSobretopeRequest(BaseModel):
    motivo: str = Field(min_length=1)
    autorizador_nombre: str | None = ""
    autorizador_email: str | None = ""


class ConfiguracionTopeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    monto_tope: Decimal
    activo: bool
    descripcion: str | None = ""
    autorizadores: list[dict] = Field(default_factory=list)
    updated_at: datetime | None = None

    @field_validator("autorizadores", mode="before")
    @classmethod
    def parse_autorizadores(cls, v):
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else []
            except Exception:
                return []
        if isinstance(v, list):
            return v
        return []


class ConfiguracionTopeUpdate(BaseModel):
    monto_tope: Decimal | None = None
    activo: bool | None = None
    descripcion: str | None = None
    autorizadores: list[dict] | None = None



class PasoAprobacionBase(BaseModel):
    orden: int = Field(default=1, ge=1)
    nombre_aprobador: str = Field(min_length=1)
    cargo_aprobador: str | None = Field(default="")
    cedula_aprobador: str | None = Field(default="")
    rol_nivel: str | None = Field(default="Aprobador")
    es_dinamico_solicitud: bool = Field(default=False)
    aprobadores_opcionales: list[dict] = Field(default_factory=list)

    @field_validator("aprobadores_opcionales", mode="before")
    @classmethod
    def parse_opcionales_paso(cls, v):
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else []
            except Exception:
                return []
        if isinstance(v, list):
            return v
        return []



class PasoAprobacionCreate(PasoAprobacionBase):
    pass


class PasoAprobacionOut(PasoAprobacionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    flujo_id: int


import json

class FlujoAprobacionBase(BaseModel):
    nombre: str = Field(min_length=1)
    descripcion: str | None = Field(default="")
    tipo_flujo: str = Field(default="personalizado")
    notificar_a_nombre: str | None = Field(default="")
    notificar_a_cargo: str | None = Field(default="")
    notificar_a_email: str | None = Field(default="")
    cargos_asociados: list[str] = Field(default_factory=list)
    aplica_a_otros_cargos: bool = Field(default=False)
    es_predeterminado: bool = Field(default=False)
    activo: bool = Field(default=True)


class FlujoAprobacionCreate(FlujoAprobacionBase):
    pasos: list[PasoAprobacionCreate] = Field(default_factory=list)


class FlujoAprobacionUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    tipo_flujo: str | None = None
    notificar_a_nombre: str | None = None
    notificar_a_cargo: str | None = None
    notificar_a_email: str | None = None
    cargos_asociados: list[str] | None = None
    aplica_a_otros_cargos: bool | None = None
    es_predeterminado: bool | None = None
    activo: bool | None = None
    pasos: list[PasoAprobacionCreate] | None = None


class FlujoAprobacionOut(FlujoAprobacionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None
    pasos: list[PasoAprobacionOut] = Field(default_factory=list)


# Schemas para Gestión de Roles y Accesos
class UsuarioRolBase(BaseModel):
    email: str = Field(min_length=3)
    nombre: str = Field(default="")
    cedula: str | None = Field(default="")
    cargo: str | None = Field(default="")
    rol: str = Field(default="SOLICITANTE")
    activo: bool = Field(default=True)


class UsuarioRolCreate(UsuarioRolBase):
    pass


class UsuarioRolUpdate(BaseModel):
    nombre: str | None = None
    cedula: str | None = None
    cargo: str | None = None
    rol: str | None = None
    activo: bool | None = None


class UsuarioRolOut(UsuarioRolBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CatalogoRolOut(BaseModel):
    id: str
    nombre: str
    descripcion: str
    color: str
    icono: str
    es_admin: bool = False




