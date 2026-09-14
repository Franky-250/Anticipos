import os
import logging
from typing import List, Optional
from datetime import datetime
import httpx

from .config import settings
logger = logging.getLogger("anticipos.mailer")

CLIENT_ID = os.getenv("CLIENT_ID", settings.client_id)
TENANT_ID = os.getenv("TENANT_ID", settings.tenant_id)
CLIENT_SECRET = os.getenv("CLIENT_SECRET", settings.client_secret)
CORREO_REMITENTE = os.getenv("CORREO_REMITENTE", settings.correo_remitente)
APP_FRONTEND_URL = os.getenv("APP_FRONTEND_URL", settings.app_frontend_url)


async def obtener_token_azure() -> Optional[str]:
    """
    Obtiene el access_token de Microsoft Graph API usando client_credentials.
    """
    if not all([CLIENT_ID, TENANT_ID, CLIENT_SECRET]):
        logger.warning("Faltan credenciales de Azure AD para Microsoft Graph API.")
        return None

    token_url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    token_data = {
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": "https://graph.microsoft.com/.default",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(token_url, data=token_data)
            if resp.status_code == 200:
                return resp.json().get("access_token")
            else:
                logger.error(f"Error obteniendo token Azure Graph ({resp.status_code}): {resp.text}")
                return None
    except Exception as exc:
        logger.error(f"Excepción conectando con Azure OAuth: {exc}")
        return None


async def enviar_correo(
    destinatario: str,
    asunto: str,
    contenido_html: str,
    cc_destinatarios: Optional[List[str]] = None,
) -> bool:
    """
    Envía un correo electrónico HTML mediante Microsoft Graph API.
    """
    if not destinatario or "@" not in destinatario:
        logger.warning(f"Destinatario no válido: {destinatario}")
        return False

    token = await obtener_token_azure()
    if not token:
        logger.warning(f"No se pudo obtener token Azure para enviar correo a {destinatario}")
        return False

    send_mail_url = f"https://graph.microsoft.com/v1.0/users/{CORREO_REMITENTE}/sendMail"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    to_recipients = [{"emailAddress": {"address": destinatario.strip()}}]
    cc_recipients = []
    if cc_destinatarios:
        for cc in cc_destinatarios:
            if cc and "@" in cc:
                cc_recipients.append({"emailAddress": {"address": cc.strip()}})

    message_obj = {
        "subject": asunto,
        "body": {
            "contentType": "HTML",
            "content": contenido_html,
        },
        "toRecipients": to_recipients,
    }
    if cc_recipients:
        message_obj["ccRecipients"] = cc_recipients

    email_payload = {
        "message": message_obj,
        "saveToSentItems": True,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(send_mail_url, json=email_payload, headers=headers)
            if resp.status_code in (200, 202):
                logger.info(f"✅ Correo enviado exitosamente a {destinatario}: {asunto}")
                return True
            else:
                logger.error(f"Error Microsoft Graph ({resp.status_code}) al enviar a {destinatario}: {resp.text}")
                return False
    except Exception as exc:
        logger.error(f"Fallo de conexión enviando correo a {destinatario}: {exc}")
        return False


def _formatear_moneda(valor: float) -> str:
    try:
        return f"${valor:,.2f}".replace(",", "@").replace(".", ",").replace("@", ".")
    except Exception:
        return f"${valor}"


# ====================================================================
# 1. NOTIFICACIÓN AL APROBADOR EN TURNO (PASO ACTUAL)
# ====================================================================

async def notificar_aprobador_turno(
    destinatario: str,
    nombre_aprobador: str,
    anticipo_id: int,
    solicitante_nombre: str,
    solicitante_cargo: str,
    solicitante_cedula: str,
    centro_costo: str,
    obra: str,
    valor: float,
    motivo_tipo: str,
    motivo_detalle: str,
    justificacion: str,
    orden_paso: int,
    total_pasos: int,
    rol_nivel: str,
    cc_aprobadores_opcionales: Optional[List[str]] = None,
    nombres_opcionales: Optional[List[str]] = None,
) -> bool:
    """
    Notifica al aprobador principal y a los aprobadores opcionales/suplentes
    que tienen un anticipo pendiente de su aprobación en la secuencia actual.
    """
    url_revision = f"{APP_FRONTEND_URL}/aprobaciones"
    valor_fmt = _formatear_moneda(valor)

    asunto = f"🔔 [Paso {orden_paso}/{total_pasos}] Anticipo #{anticipo_id} Requiere tu Aprobación - {solicitante_nombre}"

    opcionales_html = ""
    if nombres_opcionales:
        nombres_str = ", ".join(nombres_opcionales)
        opcionales_html = f"""
        <div class="fila-detalle" style="background: #f8fafc; padding: 6px 8px; border-radius: 6px; margin-top: 4px;">
            <span class="etiqueta" style="color: #6366f1;">👥 Aprobadores Suplentes:</span>
            <span class="valor" style="color: #4338ca; font-size: 13px;">{nombres_str}</span>
        </div>
        """

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }}
        .wrapper {{ width: 100%; background-color: #f8fafc; padding: 30px 0; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }}
        .header {{ background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 25px 30px; color: #ffffff; }}
        .header-tag {{ display: inline-block; background: #4f46e5; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 999px; margin-bottom: 8px; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; }}
        .body {{ padding: 30px; color: #334155; }}
        .saludo {{ font-size: 15px; margin-bottom: 16px; color: #0f172a; }}
        .badge-nivel {{ background: #e0e7ff; color: #3730a3; padding: 6px 12px; border-radius: 8px; font-weight: 700; display: inline-block; margin-bottom: 20px; font-size: 13px; border: 1px solid #c7d2fe; }}
        .card-detalle {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 25px; }}
        .fila-detalle {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #edf2f7; font-size: 14px; }}
        .fila-detalle:last-child {{ border-bottom: none; }}
        .etiqueta {{ color: #64748b; font-weight: 500; }}
        .valor {{ color: #0f172a; font-weight: 600; text-align: right; }}
        .valor-monto {{ color: #4f46e5; font-size: 19px; font-weight: 800; }}
        .btn-accion {{ display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 13px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; text-align: center; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); }}
        .btn-accion:hover {{ background: #4338ca; }}
        .footer {{ text-align: center; font-size: 12px; color: #94a3b8; padding: 20px; border-top: 1px solid #f1f5f9; background: #fafafa; }}
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <span class="header-tag">Flujo de Aprobación Multinivel</span>
                <h1>Solicitud de Anticipo #{anticipo_id}</h1>
            </div>
            <div class="body">
                <p class="saludo">Hola <strong>{nombre_aprobador}</strong>,</p>
                <p>Se ha generado una solicitud de anticipo que requiere tu revisión y aprobación en este momento:</p>
                
                <div class="badge-nivel">
                    ⛓️ Nivel de Aprobación: <strong>Paso {orden_paso} de {total_pasos}</strong> ({rol_nivel})
                </div>

                <div class="card-detalle">
                    <div class="fila-detalle">
                        <span class="etiqueta">Solicitante:</span>
                        <span class="valor">{solicitante_nombre}</span>
                    </div>
                    <div class="fila-detalle">
                        <span class="etiqueta">Cargo:</span>
                        <span class="valor">{solicitante_cargo or 'N/A'}</span>
                    </div>
                    <div class="fila-detalle">
                        <span class="etiqueta">Cédula:</span>
                        <span class="valor">{solicitante_cedula}</span>
                    </div>
                    <div class="fila-detalle">
                        <span class="etiqueta">Centro de Costo / Obra:</span>
                        <span class="valor">{centro_costo} - {obra}</span>
                    </div>
                    <div class="fila-detalle">
                        <span class="etiqueta">Motivo / Tipo:</span>
                        <span class="valor">{motivo_tipo.capitalize()} {f'- {motivo_detalle}' if motivo_detalle else ''}</span>
                    </div>
                    {f'<div class="fila-detalle"><span class="etiqueta">Justificación:</span><span class="valor">{justificacion}</span></div>' if justificacion else ''}
                    {opcionales_html}
                    <div class="fila-detalle" style="padding-top: 12px; border-top: 2px solid #e2e8f0;">
                        <span class="etiqueta" style="font-size: 15px; font-weight: 700; color: #0f172a;">Valor Solicitado:</span>
                        <span class="valor-monto">{valor_fmt}</span>
                    </div>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="{url_revision}" class="btn-accion" target="_blank">
                        ⚡ Revisar y Tomar Decisión en el Portal
                    </a>
                </div>

                <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
                    Cualquiera de los aprobadores autorizados en este nivel (principal o suplentes) puede ingresar y tomar la decisión correspondiente.
                </p>
            </div>
            <div class="footer">
                Sistema de Anticipos &middot; PCMejia &middot; Correo generado automáticamente por Ecosistema Pandora
            </div>
        </div>
    </div>
</body>
</html>
"""
    return await enviar_correo(destinatario, asunto, html, cc_destinatarios=cc_aprobadores_opcionales)


# ====================================================================
# 2. CONFIRMACIÓN DE RADICACIÓN AL SOLICITANTE
# ====================================================================

async def notificar_radicacion_solicitante(
    destinatario: str,
    solicitante_nombre: str,
    anticipo_id: int,
    valor: float,
    centro_costo: str,
    obra: str,
    primer_aprobador_nombre: str,
    primer_aprobador_rol: str,
    total_pasos: int,
) -> bool:
    """
    Informa al solicitante que su anticipo fue radicado exitosamente y quién es el primer aprobador.
    """
    valor_fmt = _formatear_moneda(valor)
    asunto = f"📋 Radicación Exitosa: Anticipo #{anticipo_id} ({valor_fmt}) en Proceso"

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }}
        .wrapper {{ width: 100%; background-color: #f8fafc; padding: 30px 0; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 25px 30px; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; }}
        .body {{ padding: 30px; color: #334155; }}
        .card-radicado {{ background: #f0f9ff; border: 1.5px solid #bae6fd; border-radius: 10px; padding: 20px; margin: 20px 0; }}
        .fila {{ display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }}
        .footer {{ text-align: center; font-size: 12px; color: #94a3b8; padding: 20px; border-top: 1px solid #f1f5f9; }}
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <h1>✅ Solicitud de Anticipo #{anticipo_id} Radicada</h1>
            </div>
            <div class="body">
                <p>Hola <strong>{solicitante_nombre}</strong>,</p>
                <p>Tu solicitud de anticipo ha sido radicada correctamente en el sistema y ha iniciado su ciclo de aprobación.</p>

                <div class="card-radicado">
                    <div class="fila"><span><strong>Monto:</strong></span><span style="color: #0284c7; font-weight: 700;">{valor_fmt}</span></div>
                    <div class="fila"><span><strong>Obra / CC:</strong></span><span>{centro_costo} - {obra}</span></div>
                    <div class="fila"><span><strong>Paso Actual (1/{total_pasos}):</strong></span><span>{primer_aprobador_rol}</span></div>
                    <div class="fila"><span><strong>Aprobador en turno:</strong></span><span style="font-weight: 600;">{primer_aprobador_nombre}</span></div>
                </div>

                <p style="font-size: 13px; color: #64748b;">
                    Te estaremos notificando por correo a medida que los aprobadores revisen tu solicitud.
                </p>
            </div>
            <div class="footer">
                Sistema de Anticipos &middot; PCMejia
            </div>
        </div>
    </div>
</body>
</html>
"""
    return await enviar_correo(destinatario, asunto, html)


# ====================================================================
# 3. SEGUIMIENTO DE AVANCE DE PASO AL SOLICITANTE
# ====================================================================

async def notificar_avance_solicitante(
    destinatario: str,
    solicitante_nombre: str,
    anticipo_id: int,
    valor: float,
    paso_aprobado_num: int,
    total_pasos: int,
    nombre_quien_aprobo: str,
    siguiente_aprobador_nombre: str,
    siguiente_rol_nivel: str,
) -> bool:
    """
    Notifica al solicitante que un paso intermedio fue aprobado y avanzó al siguiente aprobador.
    """
    valor_fmt = _formatear_moneda(valor)
    siguiente_paso_num = paso_aprobado_num + 1
    asunto = f"⚡ Avance de Anticipo #{anticipo_id}: Paso {paso_aprobado_num} Aprobado por {nombre_quien_aprobo}"

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }}
        .wrapper {{ width: 100%; background-color: #f8fafc; padding: 30px 0; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #4338ca 0%, #312e81 100%); padding: 25px 30px; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; }}
        .body {{ padding: 30px; color: #334155; }}
        .card-avance {{ background: #eef2ff; border: 1.5px solid #c7d2fe; border-radius: 10px; padding: 20px; margin: 20px 0; }}
        .fila {{ display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }}
        .footer {{ text-align: center; font-size: 12px; color: #94a3b8; padding: 20px; border-top: 1px solid #f1f5f9; }}
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <h1>⚡ Anticipo #{anticipo_id}: Progreso del Flujo</h1>
            </div>
            <div class="body">
                <p>Hola <strong>{solicitante_nombre}</strong>,</p>
                <p>Tu solicitud de anticipo ha completado un nuevo nivel de aprobación:</p>

                <div class="card-avance">
                    <div class="fila"><span><strong>Monto Solicitado:</strong></span><span style="font-weight: 700; color: #4338ca;">{valor_fmt}</span></div>
                    <div class="fila"><span><strong>Paso Aprobado:</strong></span><span>Nivel {paso_aprobado_num} de {total_pasos}</span></div>
                    <div class="fila"><span><strong>Aprobado por:</strong></span><span style="font-weight: 600; color: #16a34a;">✅ {nombre_quien_aprobo}</span></div>
                    <div class="fila" style="margin-top: 8px; border-top: 1px solid #c7d2fe; padding-top: 8px;">
                        <span><strong>Siguiente Paso ({siguiente_paso_num}/{total_pasos}):</strong></span>
                        <span style="font-weight: 600; color: #1e1b4b;">{siguiente_rol_nivel}</span>
                    </div>
                    <div class="fila"><span><strong>Aprobador en turno:</strong></span><span style="font-weight: 600;">{siguiente_aprobador_nombre}</span></div>
                </div>

                <p style="font-size: 13px; color: #64748b;">
                    Se ha enviado una notificación automática a {siguiente_aprobador_nombre} para que proceda con su revisión.
                </p>
            </div>
            <div class="footer">
                Sistema de Anticipos &middot; PCMejia
            </div>
        </div>
    </div>
</body>
</html>
"""
    return await enviar_correo(destinatario, asunto, html)


# ====================================================================
# 4. APROBACIÓN FINAL AL SOLICITANTE
# ====================================================================

async def notificar_aprobacion_final_solicitante(
    destinatario: str,
    solicitante_nombre: str,
    anticipo_id: int,
    valor: float,
    centro_costo: str,
    obra: str,
) -> bool:
    """
    Notifica al solicitante que su anticipo completó el 100% de aprobaciones.
    """
    valor_fmt = _formatear_moneda(valor)
    asunto = f"🎉 ¡Anticipo #{anticipo_id} APROBADO Totalmente! ({valor_fmt}) - {solicitante_nombre}"

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }}
        .wrapper {{ width: 100%; background-color: #f8fafc; padding: 30px 0; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #15803d 0%, #166534 100%); padding: 25px 30px; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; }}
        .body {{ padding: 30px; color: #334155; }}
        .card-exito {{ background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 10px; padding: 20px; margin: 20px 0; }}
        .monto {{ font-size: 22px; font-weight: 800; color: #166534; }}
        .footer {{ text-align: center; font-size: 12px; color: #94a3b8; padding: 20px; border-top: 1px solid #f1f5f9; }}
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <h1>🎉 Anticipo #{anticipo_id} Totalmente Aprobado</h1>
            </div>
            <div class="body">
                <p>Estimado(a) <strong>{solicitante_nombre}</strong>,</p>
                <p>Nos complace informarte que tu solicitud de anticipo ha completado exitosamente <strong>todos los niveles de aprobación</strong>.</p>

                <div class="card-exito">
                    <div style="font-size: 14px; margin-bottom: 6px;"><strong>Centro / Obra:</strong> {centro_costo} - {obra}</div>
                    <div style="font-size: 14px; margin-bottom: 12px;"><strong>Monto Aprobado:</strong> <span class="monto">{valor_fmt}</span></div>
                    <div style="font-size: 13px; color: #15803d; font-weight: 700;">✅ ESTADO: APROBADO &middot; Listo para desembolso</div>
                </div>

                <p style="font-size: 13px; color: #64748b;">
                    La persona responsable de pagos / tesorería configurada en el flujo ya ha sido notificada para proceder con la programación del desembolso.
                </p>
            </div>
            <div class="footer">
                Sistema de Anticipos &middot; PCMejia
            </div>
        </div>
    </div>
</body>
</html>
"""
    return await enviar_correo(destinatario, asunto, html)


# ====================================================================
# 5. NOTIFICACIÓN AL RESPONSABLE FINAL DEL FLUJO (TESORERÍA / PAGOS)
# ====================================================================

async def notificar_responsable_flujo_final(
    destinatario: str,
    nombre_responsable: str,
    cargo_responsable: str,
    anticipo_id: int,
    solicitante_nombre: str,
    solicitante_cedula: str,
    solicitante_cargo: str,
    solicitante_empresa: str,
    valor: float,
    centro_costo: str,
    obra: str,
    motivo_tipo: str,
    motivo_detalle: str,
    justificacion: str,
    flujo_nombre: str,
    pasos_historial: list,
) -> bool:
    """
    Notifica específicamente a la persona asignada en el flujo ('notificar_a_email')
    cuando el anticipo ha superado el último paso de aprobación para que proceda al desembolso/recaudo.
    """
    url_recaudo = f"{APP_FRONTEND_URL}/recaudo"
    valor_fmt = _formatear_moneda(valor)

    asunto = f"🚨 [DESEMBOLSO] Anticipo #{anticipo_id} ({valor_fmt}) Aprobado 100% - {solicitante_nombre}"

    # Construir filas de historial de aprobaciones
    filas_pasos_html = ""
    for p in pasos_historial:
        filas_pasos_html += f"""
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
            <td style="padding: 8px 10px; font-weight: 600;">Paso {p.get('orden')} ({p.get('rol_nivel', 'Aprobador')}):</td>
            <td style="padding: 8px 10px; color: #16a34a; font-weight: 600;">✅ {p.get('aprobador', 'Aprobado')}</td>
            <td style="padding: 8px 10px; color: #64748b; font-size: 12px;">{p.get('fecha', '')}</td>
        </tr>
        """

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }}
        .wrapper {{ width: 100%; background-color: #f8fafc; padding: 30px 0; }}
        .container {{ max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 20px rgba(0,0,0,0.06); }}
        .header {{ background: linear-gradient(135deg, #0f172a 0%, #166534 100%); padding: 25px 30px; color: #ffffff; }}
        .header-tag {{ display: inline-block; background: #22c55e; color: #052e16; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 999px; margin-bottom: 8px; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; }}
        .body {{ padding: 30px; color: #334155; }}
        .saludo {{ font-size: 15px; margin-bottom: 16px; color: #0f172a; }}
        .card-detalle {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 20px; }}
        .fila-detalle {{ display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #edf2f7; font-size: 14px; }}
        .fila-detalle:last-child {{ border-bottom: none; }}
        .etiqueta {{ color: #64748b; font-weight: 500; }}
        .valor {{ color: #0f172a; font-weight: 600; text-align: right; }}
        .valor-monto {{ color: #16a34a; font-size: 20px; font-weight: 800; }}
        .card-historial {{ background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 15px; margin-bottom: 25px; }}
        .btn-accion {{ display: inline-block; background: #16a34a; color: #ffffff !important; text-decoration: none; padding: 13px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; text-align: center; box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3); }}
        .btn-accion:hover {{ background: #15803d; }}
        .footer {{ text-align: center; font-size: 12px; color: #94a3b8; padding: 20px; border-top: 1px solid #f1f5f9; background: #fafafa; }}
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <span class="header-tag">Notificación de Desembolso / Recaudo</span>
                <h1>Anticipo #{anticipo_id} Totalmente Aprobado</h1>
            </div>
            <div class="body">
                <p class="saludo">Estimado(a) <strong>{nombre_responsable}</strong> ({cargo_responsable or 'Tesorería / Pagos'}),</p>
                <p>
                    Se te notifica formalmente que la solicitud de anticipo #{anticipo_id} ha <strong>superado el último paso de aprobación</strong> del flujo <em>"{flujo_nombre}"</em> y queda autorizada para programación de pago / desembolso.
                </p>

                <div class="card-detalle">
                    <div class="fila-detalle">
                        <span class="etiqueta">Solicitante:</span>
                        <span class="valor">{solicitante_nombre}</span>
                    </div>
                    <div class="fila-detalle">
                        <span class="etiqueta">Cédula:</span>
                        <span class="valor">{solicitante_cedula}</span>
                    </div>
                    <div class="fila-detalle">
                        <span class="etiqueta">Cargo / Empresa:</span>
                        <span class="valor">{solicitante_cargo or 'N/A'} {f'· {solicitante_empresa}' if solicitante_empresa else ''}</span>
                    </div>
                    <div class="fila-detalle">
                        <span class="etiqueta">Centro de Costo:</span>
                        <span class="valor">{centro_costo} - {obra}</span>
                    </div>
                    <div class="fila-detalle">
                        <span class="etiqueta">Motivo:</span>
                        <span class="valor">{motivo_tipo.capitalize()} {f'- {motivo_detalle}' if motivo_detalle else ''}</span>
                    </div>
                    {f'<div class="fila-detalle"><span class="etiqueta">Justificación:</span><span class="valor">{justificacion}</span></div>' if justificacion else ''}
                    <div class="fila-detalle" style="padding-top: 10px; border-top: 2px solid #e2e8f0;">
                        <span class="etiqueta" style="font-size: 15px; font-weight: 700; color: #0f172a;">Total a Desembolsar:</span>
                        <span class="valor-monto">{valor_fmt}</span>
                    </div>
                </div>

                <div class="card-historial">
                    <div style="font-size: 14px; font-weight: 700; color: #166534; margin-bottom: 10px;">
                        📜 Trazabilidad de Aprobaciones Recibidas:
                    </div>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tbody>
                            {filas_pasos_html}
                        </tbody>
                    </table>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="{url_recaudo}" class="btn-accion" target="_blank">
                        💳 Ir a la Gestión de Recaudo / Pagos
                    </a>
                </div>
            </div>
            <div class="footer">
                Sistema de Anticipos &middot; PCMejia &middot; Ecosistema Pandora
            </div>
        </div>
    </div>
</body>
</html>
"""
    return await enviar_correo(destinatario, asunto, html)


# ====================================================================
# 6. NOTIFICACIÓN DE RECHAZO AL SOLICITANTE
# ====================================================================

async def notificar_rechazo(
    destinatario: str,
    solicitante_nombre: str,
    anticipo_id: int,
    aprobador_rechaza: str,
    motivo_rechazo: str,
    paso_rechazado_orden: int = 1,
    total_pasos: int = 1,
) -> bool:
    """
    Notifica al solicitante cuando su anticipo ha sido rechazado en alguno de los pasos.
    """
    asunto = f"❌ Anticipo #{anticipo_id} NO Aprobado (Rechazado en Paso {paso_rechazado_orden}/{total_pasos})"

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }}
        .wrapper {{ width: 100%; background-color: #f8fafc; padding: 30px 0; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%); padding: 25px 30px; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; }}
        .body {{ padding: 30px; color: #334155; }}
        .card-rechazo {{ background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 10px; padding: 20px; margin: 20px 0; }}
        .footer {{ text-align: center; font-size: 12px; color: #94a3b8; padding: 20px; border-top: 1px solid #f1f5f9; }}
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <h1>Solicitud de Anticipo #{anticipo_id} No Aprobada</h1>
            </div>
            <div class="body">
                <p>Estimado(a) <strong>{solicitante_nombre}</strong>,</p>
                <p>Te informamos que tu solicitud de anticipo no fue autorizada durante el proceso de revisión:</p>

                <div class="card-rechazo">
                    <div style="font-size: 14px; margin-bottom: 8px;"><strong>Revisado por:</strong> {aprobador_rechaza} (Nivel {paso_rechazado_orden} de {total_pasos})</div>
                    <div style="font-size: 14px; color: #991b1b; font-weight: 600;">Motivo / Observación del Rechazo:</div>
                    <p style="margin: 6px 0 0 0; font-size: 14px; color: #7f1d1d; font-style: italic; background: #ffffff; padding: 10px; border-radius: 6px; border: 1px solid #fee2e2;">
                        "{motivo_rechazo or 'Sin observaciones especificadas.'}"
                    </p>
                </div>

                <p style="font-size: 13px; color: #64748b;">
                    Si requieres mayor información, por favor contacta directamente con la persona que revisó tu solicitud.
                </p>
            </div>
            <div class="footer">
                Sistema de Anticipos &middot; PCMejia
            </div>
        </div>
    </div>
</body>
</html>
"""
    return await enviar_correo(destinatario, asunto, html)


# ====================================================================
# 6. NOTIFICACIONES DE CONTROL DE TOPE Y SOBRETOPE
# ====================================================================

async def notificar_solicitud_sobretope(
    destinatario: str,
    autorizador_nombre: str,
    anticipo_id: int,
    solicitante_nombre: str,
    solicitante_cargo: str,
    solicitante_cedula: str,
    centro_costo: str,
    obra: str,
    valor: float,
    monto_tope: float,
    motivo_tipo: str,
    motivo_detalle: str,
    justificacion: str,
) -> bool:
    """
    Notifica a la persona designada para autorizar una solicitud de anticipo que supera el tope estándar.
    """
    url_revision = f"{APP_FRONTEND_URL}/aprobaciones"
    asunto = f"⚠️ Requiere Pre-Autorización: Anticipo #{anticipo_id} SUPERÓ TOPE ({_formatear_moneda(valor)} vs Tope {_formatear_moneda(monto_tope)})"

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }}
        .wrapper {{ width: 100%; background-color: #f8fafc; padding: 30px 0; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1.5px solid #fde68a; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
        .header {{ background: linear-gradient(135deg, #d97706 0%, #b45309 100%); padding: 25px 30px; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; }}
        .badge-tope {{ display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; margin-top: 8px; }}
        .body {{ padding: 30px; color: #334155; }}
        .banner-alerta {{ background: #fffbeb; border: 1.5px solid #fef3c7; border-radius: 10px; padding: 16px; margin: 18px 0; font-size: 14px; color: #92400e; }}
        .card-monto {{ background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center; }}
        .card-monto .valor {{ font-size: 28px; font-weight: 800; color: #b45309; }}
        .card-monto .comparativa {{ font-size: 13px; color: #64748b; margin-top: 4px; }}
        .detalles-tabla {{ width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px; }}
        .detalles-tabla td {{ padding: 8px 0; border-bottom: 1px solid #f1f5f9; }}
        .detalles-tabla td.label {{ color: #64748b; width: 40%; }}
        .detalles-tabla td.val {{ font-weight: 600; color: #0f172a; width: 60%; }}
        .btn {{ display: inline-block; background: #d97706; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 15px; margin-top: 15px; text-align: center; }}
        .footer {{ text-align: center; font-size: 12px; color: #94a3b8; padding: 20px; border-top: 1px solid #f1f5f9; }}
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <h1>Solicitud de Anticipo Superó Tope Máximo</h1>
                <div class="badge-tope">⚠️ Requiere tu Autorización Previa de Sobretope</div>
            </div>
            <div class="body">
                <p>Estimado(a) <strong>{autorizador_nombre}</strong>,</p>
                <p>El colaborador <strong>{solicitante_nombre}</strong> ha radicado una solicitud de anticipo que <strong>supera el tope estándar permitido ({_formatear_moneda(monto_tope)})</strong> y te ha seleccionado como la persona autorizada para avalar el sobretope:</p>

                <div class="card-monto">
                    <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 700;">Monto Solicitado</div>
                    <div class="valor">{_formatear_moneda(valor)}</div>
                    <div class="comparativa">Tope estándar permitido: <strong>{_formatear_moneda(monto_tope)}</strong></div>
                </div>

                <table class="detalles-tabla">
                    <tr><td class="label">Solicitante:</td><td class="val">{solicitante_nombre}</td></tr>
                    <tr><td class="label">Cédula:</td><td class="val">{solicitante_cedula}</td></tr>
                    <tr><td class="label">Cargo:</td><td class="val">{solicitante_cargo or 'N/A'}</td></tr>
                    <tr><td class="label">Obra:</td><td class="val">{obra} ({centro_costo})</td></tr>
                    <tr><td class="label">Motivo:</td><td class="val">{motivo_tipo.capitalize()} - {motivo_detalle or 'N/A'}</td></tr>
                    <tr><td class="label">Justificación:</td><td class="val">{justificacion or 'Sin justificación detallada'}</td></tr>
                </table>

                <div class="banner-alerta">
                    <strong>Importante:</strong> Esta solicitud permanecerá en espera hasta que decidas autorizar o rechazar el sobretope. Si autorizas el monto, ingresará inmediatamente al flujo de aprobación correspondiente.
                </div>

                <div style="text-align: center;">
                    <a href="{url_revision}" class="btn">Revisar y Autorizar Sobretope</a>
                </div>
            </div>
            <div class="footer">
                Sistema de Anticipos &middot; PCMejia
            </div>
        </div>
    </div>
</body>
</html>
"""
    return await enviar_correo(destinatario, asunto, html)


async def notificar_rechazo_sobretope(
    destinatario: str,
    solicitante_nombre: str,
    anticipo_id: int,
    autorizador_nombre: str,
    valor: float,
    monto_tope: float,
    motivo_rechazo: str,
) -> bool:
    """
    Notifica al solicitante que su solicitud que superó el tope fue rechazada en la fase de pre-autorización.
    """
    asunto = f"❌ Anticipo #{anticipo_id} RECHAZADO: No se autorizó el sobretope ({_formatear_moneda(valor)})"

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }}
        .wrapper {{ width: 100%; background-color: #f8fafc; padding: 30px 0; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #fca5a5; overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%); padding: 25px 30px; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; }}
        .body {{ padding: 30px; color: #334155; }}
        .card-rechazo {{ background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 10px; padding: 20px; margin: 20px 0; }}
        .footer {{ text-align: center; font-size: 12px; color: #94a3b8; padding: 20px; border-top: 1px solid #f1f5f9; }}
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <h1>Sobretope de Anticipo #{anticipo_id} No Autorizado</h1>
            </div>
            <div class="body">
                <p>Estimado(a) <strong>{solicitante_nombre}</strong>,</p>
                <p>Te informamos que tu solicitud de anticipo por valor de <strong>{_formatear_moneda(valor)}</strong>, la cual superó el tope máximo estándar de <strong>{_formatear_moneda(monto_tope)}</strong>, <strong>no fue autorizada</strong> por el responsable de sobretope:</p>

                <div class="card-rechazo">
                    <div style="font-size: 14px; margin-bottom: 8px;"><strong>Revisado por:</strong> {autorizador_nombre} (Autorizador de Sobretope)</div>
                    <div style="font-size: 14px; color: #991b1b; font-weight: 600;">Motivo del Rechazo:</div>
                    <p style="margin: 6px 0 0 0; font-size: 14px; color: #7f1d1d; font-style: italic; background: #ffffff; padding: 10px; border-radius: 6px; border: 1px solid #fee2e2;">
                        "{motivo_rechazo or 'El monto excede el límite permitido y no cuenta con autorización especial.'}"
                    </p>
                </div>

                <p style="font-size: 13px; color: #64748b;">
                    Tu solicitud ha sido cancelada. Si necesitas el anticipo, por favor radica una nueva solicitud ajustada al tope permitido o coordina previamente con el autorizador.
                </p>
            </div>
            <div class="footer">
                Sistema de Anticipos &middot; PCMejia
            </div>
        </div>
    </div>
</body>
</html>
"""
    return await enviar_correo(destinatario, asunto, html)


async def notificar_aprobacion_sobretope_solicitante(
    destinatario: str,
    solicitante_nombre: str,
    anticipo_id: int,
    autorizador_nombre: str,
    valor: float,
    primer_aprobador_nombre: str,
    primer_aprobador_rol: str,
) -> bool:
    """
    Notifica al solicitante que su sobretope fue aprobado y que su solicitud ingresó al flujo formal de aprobación.
    """
    asunto = f"✅ Sobretope Autorizado: Anticipo #{anticipo_id} ({_formatear_moneda(valor)}) ingresó al flujo de aprobación"

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }}
        .wrapper {{ width: 100%; background-color: #f8fafc; padding: 30px 0; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #bbf7d0; overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 25px 30px; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; }}
        .body {{ padding: 30px; color: #334155; }}
        .banner {{ background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 10px; padding: 18px; margin: 18px 0; }}
        .footer {{ text-align: center; font-size: 12px; color: #94a3b8; padding: 20px; border-top: 1px solid #f1f5f9; }}
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <h1>Sobretope Autorizado Exitosamente</h1>
            </div>
            <div class="body">
                <p>Estimado(a) <strong>{solicitante_nombre}</strong>,</p>
                <p>Te informamos que <strong>{autorizador_nombre}</strong> ha <strong>autorizado el monto especial</strong> de tu anticipo <strong>#{anticipo_id}</strong> por valor de <strong>{_formatear_moneda(valor)}</strong>.</p>

                <div class="banner">
                    <div style="font-size: 14px; color: #065f46; font-weight: 700;">🚀 Tu solicitud ya ingresó al flujo de aprobación formal:</div>
                    <div style="font-size: 14px; color: #047857; margin-top: 6px;">
                        Actualmente está en el <strong>Paso 1 ({primer_aprobador_rol})</strong> asignado a <strong>{primer_aprobador_nombre}</strong>.
                    </div>
                </div>

                <p style="font-size: 13px; color: #64748b;">
                    Te seguiremos notificando automáticamente a medida que avance el ciclo de firmas.
                </p>
            </div>
            <div class="footer">
                Sistema de Anticipos &middot; PCMejia
            </div>
        </div>
    </div>
</body>
</html>
"""
    return await enviar_correo(destinatario, asunto, html)
