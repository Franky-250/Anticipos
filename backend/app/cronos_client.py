import time

import httpx

from .config import settings

_CACHE_TTL_SECONDS = 300
_cache: dict[str, tuple[float, list[dict]]] = {}


async def _get(path: str, params: dict | None = None) -> dict:
    headers = {"X-API-Key": settings.cronos_api_key}
    async with httpx.AsyncClient(base_url=settings.cronos_api_url, timeout=15) as client:
        response = await client.get(path, headers=headers, params=params)
        response.raise_for_status()
        return response.json()


async def _get_all_usuarios() -> list[dict]:
    cached = _cache.get("usuarios")
    if cached and time.monotonic() - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    usuarios: list[dict] = []
    page = 1
    while True:
        data = await _get("/usuarios", {"page": page, "size": 500})
        usuarios.extend(data["data"])
        if page >= data["total_pages"]:
            break
        page += 1

    _cache["usuarios"] = (time.monotonic(), usuarios)
    return usuarios


async def buscar_empleados(query: str, limite: int = 20) -> list[dict]:
    usuarios = await _get_all_usuarios()
    query_normalizada = query.strip().lower()
    if not query_normalizada:
        return []

    resultados = [
        u
        for u in usuarios
        if query_normalizada in u["nombre_completo"].lower()
        or query_normalizada in u["doc_identidad"].lower()
    ]
    return resultados[:limite]


async def listar_directores() -> list[dict]:
    usuarios = await _get_all_usuarios()
    return [u for u in usuarios if u.get("cargo") and "DIRECTOR" in u["cargo"].upper()]


async def listar_centros() -> list[dict]:
    usuarios = await _get_all_usuarios()
    centros: dict[str, str] = {}
    for u in usuarios:
        if u.get("cod_centro") and u.get("centro"):
            centros[u["cod_centro"]] = u["centro"]
    return [
        {"codigo": codigo, "nombre": nombre}
        for codigo, nombre in sorted(centros.items(), key=lambda item: item[1])
    ]
