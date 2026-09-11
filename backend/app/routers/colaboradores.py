import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import cronos_client, models, schemas
from ..database import get_db

router = APIRouter(prefix="/api", tags=["colaboradores", "flujos"])


def _parse_flujo_out(flujo: models.FlujoAprobacion) -> dict:
    cargos = []
    if flujo.cargos_asociados:
        try:
            if isinstance(flujo.cargos_asociados, list):
                cargos = flujo.cargos_asociados
            else:
                cargos = json.loads(flujo.cargos_asociados)
        except Exception:
            cargos = []

    pasos_out = []
    for p in flujo.pasos:
        opcs = []
        if p.aprobadores_opcionales:
            try:
                opcs = json.loads(p.aprobadores_opcionales) if isinstance(p.aprobadores_opcionales, str) else p.aprobadores_opcionales
            except Exception:
                opcs = []

        pasos_out.append({
            "id": p.id,
            "flujo_id": p.flujo_id,
            "orden": p.orden,
            "nombre_aprobador": p.nombre_aprobador,
            "cargo_aprobador": p.cargo_aprobador or "",
            "cedula_aprobador": p.cedula_aprobador or "",
            "rol_nivel": p.rol_nivel or "Aprobador",
            "es_dinamico_solicitud": bool(p.es_dinamico_solicitud),
            "aprobadores_opcionales": opcs if isinstance(opcs, list) else [],
        })

    return {
        "id": flujo.id,
        "nombre": flujo.nombre,
        "descripcion": flujo.descripcion or "",
        "tipo_flujo": flujo.tipo_flujo or "personalizado",
        "notificar_a_nombre": flujo.notificar_a_nombre or "",
        "notificar_a_cargo": flujo.notificar_a_cargo or "",
        "notificar_a_email": flujo.notificar_a_email or "",
        "cargos_asociados": cargos,
        "aplica_a_otros_cargos": bool(flujo.aplica_a_otros_cargos),
        "es_predeterminado": bool(flujo.es_predeterminado),
        "activo": bool(flujo.activo),
        "created_at": flujo.created_at,
        "updated_at": flujo.updated_at,
        "pasos": pasos_out,
    }


@router.get("/colaboradores/segmentados")
async def obtener_colaboradores_segmentados(db: Session = Depends(get_db)):
    """
    Retorna la lista de colaboradores segmentada por:
    - Residentes de obra
    - Directores y directivos
    - Todos los colaboradores
    - Métricas consolidadas
    """
    usuarios = await cronos_client._get_all_usuarios()

    residentes = []
    directores = []
    todos = []

    for u in usuarios:
        item = {
            "cedula": u.get("doc_identidad") or "",
            "nombre": u.get("nombre_completo") or "",
            "cargo": u.get("cargo") or "",
            "email": u.get("correo_corporativo") or u.get("correo") or u.get("email") or "",
            "empresa": u.get("empresa") or u.get("sociedad") or u.get("compania") or "",
            "centro_codigo": u.get("cod_centro") or "",
            "centro_nombre": u.get("centro") or "",
        }
        todos.append(item)

        cargo_upper = (item["cargo"] or "").upper()
        if "RESIDENTE" in cargo_upper or "MAESTRO" in cargo_upper:
            residentes.append(item)
        if "DIRECTOR" in cargo_upper or "GERENTE" in cargo_upper or "SUBDIRECTOR" in cargo_upper:
            directores.append(item)

    flujos_count = db.query(models.FlujoAprobacion).filter(models.FlujoAprobacion.activo == True).count()

    return {
        "estadisticas": {
            "total_colaboradores": len(todos),
            "total_residentes": len(residentes),
            "total_directores": len(directores),
            "total_flujos": flujos_count,
        },
        "residentes": sorted(residentes, key=lambda x: x["nombre"].lower()),
        "directores": sorted(directores, key=lambda x: x["nombre"].lower()),
        "todos": sorted(todos, key=lambda x: x["nombre"].lower()),
    }


# ==========================================
# GESTIÓN DE FLUJOS DE APROBACIÓN
# ==========================================


@router.get("/flujos-aprobacion", response_model=list[schemas.FlujoAprobacionOut])
def listar_flujos_aprobacion(db: Session = Depends(get_db)):
    flujos = db.query(models.FlujoAprobacion).order_by(models.FlujoAprobacion.id).all()
    return [_parse_flujo_out(f) for f in flujos]


@router.get("/flujos-aprobacion/evaluar-por-cargo")
def evaluar_flujo_por_cargo(cargo: str = Query(default=""), db: Session = Depends(get_db)):
    """
    Evalúa qué flujo de aprobación corresponde al cargo indicado:
    1. Si el cargo coincide explícitamente con los cargos de un flujo activo -> retorna ese flujo.
    2. Si ningún flujo tiene ese cargo específico -> busca el flujo comodín ('aplica_a_otros_cargos'=True).
    3. Si aún no hay coincidencia, retorna el primer flujo activo o null.
    """
    flujos = (
        db.query(models.FlujoAprobacion)
        .filter(models.FlujoAprobacion.activo == True)
        .order_by(models.FlujoAprobacion.id)
        .all()
    )

    cargo_normalizado = cargo.strip().upper()
    flujo_especifico = None
    flujo_comodin = None

    for f in flujos:
        cargos = []
        if f.cargos_asociados:
            try:
                cargos = json.loads(f.cargos_asociados) if isinstance(f.cargos_asociados, str) else f.cargos_asociados
            except Exception:
                cargos = []
        cargos_upper = [str(c).strip().upper() for c in cargos]

        if cargo_normalizado and cargo_normalizado in cargos_upper:
            flujo_especifico = f
            break

        if f.aplica_a_otros_cargos and not flujo_comodin:
            flujo_comodin = f

    resultado = flujo_especifico or flujo_comodin or (flujos[0] if flujos else None)
    if resultado:
        return _parse_flujo_out(resultado)
    return None


@router.get("/flujos-aprobacion/{flujo_id}", response_model=schemas.FlujoAprobacionOut)
def obtener_flujo_aprobacion(flujo_id: int, db: Session = Depends(get_db)):
    flujo = db.get(models.FlujoAprobacion, flujo_id)
    if not flujo:
        raise HTTPException(status_code=404, detail="Flujo de aprobación no encontrado")
    return _parse_flujo_out(flujo)


@router.post("/flujos-aprobacion", response_model=schemas.FlujoAprobacionOut, status_code=201)
def crear_flujo_aprobacion(datos: schemas.FlujoAprobacionCreate, db: Session = Depends(get_db)):
    pasos_data = datos.pasos
    flujo_dict = datos.model_dump(exclude={"pasos"})

    if "cargos_asociados" in flujo_dict and isinstance(flujo_dict["cargos_asociados"], list):
        flujo_dict["cargos_asociados"] = json.dumps(flujo_dict["cargos_asociados"])

    flujo = models.FlujoAprobacion(**flujo_dict)
    db.add(flujo)
    db.flush()

    for idx, p in enumerate(pasos_data, start=1):
        paso_dict = p.model_dump()
        paso_dict["orden"] = idx
        if "aprobadores_opcionales" in paso_dict and isinstance(paso_dict["aprobadores_opcionales"], list):
            paso_dict["aprobadores_opcionales"] = json.dumps(paso_dict["aprobadores_opcionales"])
        paso = models.PasoAprobacion(flujo_id=flujo.id, **paso_dict)
        db.add(paso)

    db.commit()
    db.refresh(flujo)
    return _parse_flujo_out(flujo)


@router.put("/flujos-aprobacion/{flujo_id}", response_model=schemas.FlujoAprobacionOut)
def actualizar_flujo_aprobacion(
    flujo_id: int,
    datos: schemas.FlujoAprobacionUpdate,
    db: Session = Depends(get_db),
):
    flujo = db.get(models.FlujoAprobacion, flujo_id)
    if not flujo:
        raise HTTPException(status_code=404, detail="Flujo de aprobación no encontrado")

    update_data = datos.model_dump(exclude_unset=True)

    if "pasos" in update_data:
        pasos_data = update_data.pop("pasos")
        # Eliminar pasos anteriores y reinsertar los nuevos
        db.query(models.PasoAprobacion).filter(models.PasoAprobacion.flujo_id == flujo_id).delete()
        if pasos_data:
            for idx, p in enumerate(pasos_data, start=1):
                if isinstance(p, dict):
                    p_dict = p
                else:
                    p_dict = p.model_dump()
                p_dict["orden"] = idx
                if "aprobadores_opcionales" in p_dict and isinstance(p_dict["aprobadores_opcionales"], list):
                    p_dict["aprobadores_opcionales"] = json.dumps(p_dict["aprobadores_opcionales"])
                paso = models.PasoAprobacion(flujo_id=flujo.id, **p_dict)
                db.add(paso)

    if "cargos_asociados" in update_data:
        if isinstance(update_data["cargos_asociados"], list):
            update_data["cargos_asociados"] = json.dumps(update_data["cargos_asociados"])

    for field, value in update_data.items():
        setattr(flujo, field, value)

    db.commit()
    db.refresh(flujo)
    return _parse_flujo_out(flujo)


@router.delete("/flujos-aprobacion/{flujo_id}", status_code=204)
def eliminar_flujo_aprobacion(flujo_id: int, db: Session = Depends(get_db)):
    flujo = db.get(models.FlujoAprobacion, flujo_id)
    if not flujo:
        raise HTTPException(status_code=404, detail="Flujo de aprobación no encontrado")

    db.delete(flujo)
    db.commit()
    return None

