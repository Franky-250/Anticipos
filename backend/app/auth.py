import os
import logging
from typing import Optional, Dict, Any
import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

logger = logging.getLogger("anticipos.auth")

PANDORA_AUTH_URL = os.getenv("PANDORA_AUTH_URL", "https://pandora.pcmejia.com")
JWT_SECRET = os.getenv("JWT_SECRET", "ms_auth_super_secret_key_987654321")

router = APIRouter(prefix="/api/auth", tags=["auth"])


class VerifyTokenRequest(BaseModel):
    token: str


class UserSession(BaseModel):
    id: Optional[int] = None
    oid: Optional[str] = None
    name: str
    email: str
    cargo: Optional[str] = None
    cedula: Optional[str] = None
    role: Optional[str] = "user"
    token: Optional[str] = None


async def verificar_token_pandora(token: str) -> Optional[Dict[str, Any]]:
    """
    Verifica un token JWT de Cerberus / Pandora llamando al endpoint central de verificación
    o decodificándolo localmente con el secreto compartido.
    """
    if not token:
        return None

    # 1. Intentar validar remotamente contra Pandora
    verify_url = f"{PANDORA_AUTH_URL}/api/v1/auth/verify"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(verify_url, json={"token": token})
            if resp.status_code == 200:
                data = resp.json()
                if data.get("valid") and data.get("user"):
                    return data["user"]
    except Exception as exc:
        logger.warning(f"No se pudo contactar directamente con Pandora ({exc}). Intentando decodificación local...")

    # 2. Fallback: decodificación JWT local con JWT_SECRET
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"verify_exp": False})
        return {
            "id": payload.get("sub") or payload.get("id"),
            "oid": payload.get("oid"),
            "name": payload.get("name") or payload.get("nombre") or payload.get("preferred_username", "Usuario Corporativo"),
            "email": payload.get("email") or payload.get("correo") or payload.get("upn", ""),
            "cargo": payload.get("cargo") or payload.get("jobTitle") or "",
            "cedula": payload.get("cedula") or "",
            "role": payload.get("role", "user"),
        }
    except Exception as e:
        logger.warning(f"Error decodificando token localmente: {e}")
        return None


@router.post("/verify-sso")
async def api_verify_sso(payload: VerifyTokenRequest):
    """
    Endpoint para que el frontend valide el token capturado por postMessage desde Pandora.
    """
    user_data = await verificar_token_pandora(payload.token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Token SSO inválido o expirado.")
    
    return {
        "valid": True,
        "user": user_data,
        "token": payload.token
    }


def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    """
    Extrae el usuario actual si el header Authorization Bearer está presente.
    """
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"verify_exp": False})
        return payload
    except Exception:
        return None
