from fastapi import APIRouter, HTTPException, Query
from httpx import HTTPStatusError

from .. import cronos_client

router = APIRouter(prefix="/api/maestras", tags=["maestras"])


@router.get("/empleados")
async def buscar_empleados(q: str = Query(min_length=2)):
    try:
        empleados = await cronos_client.buscar_empleados(q)
    except HTTPStatusError:
        raise HTTPException(status_code=502, detail="No se pudo consultar la maestra de empleados")

    return [
        {
            "cedula": e["doc_identidad"],
            "nombre": e["nombre_completo"],
            "cargo": e.get("cargo"),
            "centro_codigo": e.get("cod_centro"),
            "centro_nombre": e.get("centro"),
        }
        for e in empleados
    ]


@router.get("/directores")
async def obtener_directores():
    try:
        directores = await cronos_client.listar_directores()
    except HTTPStatusError:
        raise HTTPException(status_code=502, detail="No se pudo consultar la maestra de directores")

    return [
        {"nombre": d["nombre_completo"], "cargo": d.get("cargo")}
        for d in directores
    ]


@router.get("/centros")
async def obtener_centros():
    try:
        return await cronos_client.listar_centros()
    except HTTPStatusError:
        raise HTTPException(status_code=502, detail="No se pudo consultar la maestra de centros de costo")
