import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import cronos_client, models, schemas
from ..database import get_db

logger = logging.getLogger("anticipos.accesos")

router = APIRouter(prefix="/api/accesos", tags=["accesos"])

ADMIN_PRINCIPAL = "jheyson.mena@pcmejia.com.co"

CATALOGO_ROLES = [
    {
        "id": "ADMINISTRADOR",
        "nombre": "Administrador del Sistema",
        "descripcion": "Acceso total a gestión de accesos y roles, configuración de flujos de aprobación, auditoría y recaudo.",
        "color": "#6366f1",
        "icono": "🛡️",
        "es_admin": True,
    },
    {
        "id": "APROBADOR",
        "nombre": "Aprobador",
        "descripcion": "Aprobación y rechazo en secuencias multinivel de anticipos, consulta de historial y solicitudes.",
        "color": "#3b82f6",
        "icono": "✍️",
        "es_admin": False,
    },
    {
        "id": "RECAUDO",
        "nombre": "Recaudo / Tesorería",
        "descripcion": "Gestión del módulo de recaudo, marcado de legalización de anticipos y consulta de saldos.",
        "color": "#10b981",
        "icono": "💵",
        "es_admin": False,
    },
    {
        "id": "SOLICITANTE",
        "nombre": "Solicitante",
        "descripcion": "Radicación de nuevas solicitudes de anticipo y consulta del estado de sus anticipos propios.",
        "color": "#f59e0b",
        "icono": "📝",
        "es_admin": False,
    },
    {
        "id": "AUDITOR",
        "nombre": "Auditor / Consulta",
        "descripcion": "Visualización y seguimiento global de anticipos, estados y métricas sin permisos de modificación.",
        "color": "#8b5cf6",
        "icono": "👁️",
        "es_admin": False,
    },
]


@router.get("/roles", response_model=list[schemas.CatalogoRolOut])
def listar_catalogo_roles():
    """
    Retorna el catálogo oficial de roles disponibles en el sistema.
    """
    return CATALOGO_ROLES


@router.get("/usuarios", response_model=list[schemas.UsuarioRolOut])
def listar_usuarios_roles(
    q: str = Query(default="", description="Búsqueda por nombre, email, cargo o cédula"),
    rol: str = Query(default="", description="Filtrar por rol"),
    db: Session = Depends(get_db),
):
    """
    Lista los usuarios con roles explícitos asignados en el sistema.
    """
    query = db.query(models.UsuarioRol)

    if rol and isinstance(rol, str) and rol.strip():
        query = query.filter(models.UsuarioRol.rol == rol.strip().upper())

    if q and isinstance(q, str) and q.strip():
        term = f"%{q.strip().lower()}%"
        query = query.filter(
            (func.lower(models.UsuarioRol.nombre).like(term))
            | (func.lower(models.UsuarioRol.email).like(term))
            | (func.lower(models.UsuarioRol.cargo).like(term))
            | (models.UsuarioRol.cedula.like(term))
        )

    return query.order_by(models.UsuarioRol.nombre.asc()).all()


@router.post("/usuarios", response_model=schemas.UsuarioRolOut)
async def asignar_o_crear_rol_usuario(
    payload: schemas.UsuarioRolCreate,
    db: Session = Depends(get_db),
):
    """
    Asigna un rol a un usuario (si ya existe lo actualiza, si no existe lo crea).
    """
    email_norm = payload.email.strip().lower()
    if not email_norm:
        raise HTTPException(status_code=400, detail="El correo electrónico es requerido.")

    # Validar rol contra catálogo
    rol_upper = payload.rol.strip().upper()
    roles_validos = {r["id"] for r in CATALOGO_ROLES}
    if rol_upper not in roles_validos:
        raise HTTPException(
            status_code=400,
            detail=f"Rol '{payload.rol}' no válido. Opciones válidas: {', '.join(roles_validos)}",
        )

    usuario = (
        db.query(models.UsuarioRol)
        .filter(func.lower(models.UsuarioRol.email) == email_norm)
        .first()
    )

    if usuario:
        # Actualizar existente
        usuario.rol = rol_upper
        if payload.nombre:
            usuario.nombre = payload.nombre.strip()
        if payload.cargo:
            usuario.cargo = payload.cargo.strip()
        if payload.cedula:
            usuario.cedula = payload.cedula.strip()
        usuario.activo = payload.activo
    else:
        # Crear nuevo
        usuario = models.UsuarioRol(
            email=email_norm,
            nombre=payload.nombre.strip() if payload.nombre else email_norm,
            cargo=payload.cargo.strip() if payload.cargo else "",
            cedula=payload.cedula.strip() if payload.cedula else "",
            rol=rol_upper,
            activo=payload.activo,
        )
        db.add(usuario)

    db.commit()
    db.refresh(usuario)
    return usuario


@router.put("/usuarios/{usuario_id}", response_model=schemas.UsuarioRolOut)
def actualizar_rol_usuario(
    usuario_id: int,
    payload: schemas.UsuarioRolUpdate,
    db: Session = Depends(get_db),
):
    """
    Actualiza la información, rol o estado activo de un usuario.
    """
    usuario = db.get(models.UsuarioRol, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    # Protección de superadministrador raíz
    if usuario.email.lower() == ADMIN_PRINCIPAL.lower():
        if payload.rol and payload.rol.upper() != "ADMINISTRADOR":
            raise HTTPException(
                status_code=400,
                detail=f"No es posible cambiar el rol del Administrador principal ({ADMIN_PRINCIPAL}).",
            )
        if payload.activo is False:
            raise HTTPException(
                status_code=400,
                detail=f"No es posible desactivar al Administrador principal ({ADMIN_PRINCIPAL}).",
            )

    if payload.nombre is not None:
        usuario.nombre = payload.nombre.strip()
    if payload.cargo is not None:
        usuario.cargo = payload.cargo.strip()
    if payload.cedula is not None:
        usuario.cedula = payload.cedula.strip()
    if payload.rol is not None:
        rol_upper = payload.rol.strip().upper()
        roles_validos = {r["id"] for r in CATALOGO_ROLES}
        if rol_upper not in roles_validos:
            raise HTTPException(
                status_code=400,
                detail=f"Rol '{payload.rol}' no válido. Opciones válidas: {', '.join(roles_validos)}",
            )
        usuario.rol = rol_upper
    if payload.activo is not None:
        usuario.activo = payload.activo

    db.commit()
    db.refresh(usuario)
    return usuario


@router.delete("/usuarios/{usuario_id}")
def eliminar_rol_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
):
    """
    Elimina la asignación de rol de un usuario (revierte a rol por defecto SOLICITANTE).
    """
    usuario = db.get(models.UsuarioRol, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    if usuario.email.lower() == ADMIN_PRINCIPAL.lower():
        raise HTTPException(
            status_code=400,
            detail=f"No es posible eliminar el rol del Administrador principal ({ADMIN_PRINCIPAL}).",
        )

    db.delete(usuario)
    db.commit()
    return {"ok": True, "message": f"Rol de {usuario.nombre} ({usuario.email}) eliminado correctamente."}
