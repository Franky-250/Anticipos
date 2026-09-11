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
            "cargo": e.get("cargo") or "",
            "email": e.get("correo_corporativo") or e.get("correo") or e.get("email") or "",
            "empresa": e.get("empresa") or e.get("sociedad") or e.get("compania") or "",
            "centro_codigo": e.get("cod_centro"),
            "centro_nombre": e.get("centro"),
        }
        for e in empleados
    ]


@router.get("/autorizadores")
async def obtener_autorizadores():
    try:
        usuarios = await cronos_client.listar_autorizadores()
    except HTTPStatusError:
        raise HTTPException(status_code=502, detail="No se pudo consultar la lista de personas autorizadoras")

    return [
        {
            "nombre": d["nombre_completo"],
            "cargo": d.get("cargo") or "",
            "email": d.get("correo_corporativo") or d.get("correo") or d.get("email") or "",
            "cedula": d.get("doc_identidad") or "",
        }
        for d in usuarios
    ]




@router.get("/directores")
async def obtener_directores():
    return await obtener_autorizadores()


@router.get("/centros")
async def obtener_centros():
    try:
        return await cronos_client.listar_centros()
    except HTTPStatusError:
        raise HTTPException(status_code=502, detail="No se pudo consultar la maestra de centros de costo")


@router.get("/cargos")
async def obtener_cargos():
    try:
        return await cronos_client.listar_cargos()
    except HTTPStatusError:
        raise HTTPException(status_code=502, detail="No se pudo consultar la maestra de cargos")

