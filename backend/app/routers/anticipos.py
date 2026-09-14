import json
import logging
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload

from .. import cronos_client, mailer, models, schemas
from ..database import get_db

logger = logging.getLogger("anticipos.router")

router = APIRouter(prefix="/api/anticipos", tags=["anticipos"])


async def _buscar_email_en_cronos(nombre: str, cedula: str = "") -> str:
    """
    Busca el correo corporativo de un colaborador en la maestra de Cronos.
    """
    try:
        usuarios = await cronos_client._get_all_usuarios()
        nombre_norm = nombre.strip().lower()
        cedula_norm = cedula.strip()

        for u in usuarios:
            u_cedula = str(u.get("doc_identidad") or "").strip()
            u_nombre = str(u.get("nombre_completo") or "").strip().lower()
            u_email = (
                u.get("correo_corporativo")
                or u.get("correo")
                or u.get("email")
                or ""
            ).strip()

            if cedula_norm and u_cedula == cedula_norm:
                return u_email
            if nombre_norm and (nombre_norm in u_nombre or u_nombre in nombre_norm):
                if u_email:
                    return u_email
    except Exception as exc:
        logger.warning(f"Error buscando email en Cronos: {exc}")
    return ""


def _evaluar_flujo_para_cargo(db: Session, cargo: str) -> models.FlujoAprobacion | None:
    """
    Evalúa qué flujo corresponde según el cargo del solicitante.
    """
    flujos = (
        db.query(models.FlujoAprobacion)
        .filter(models.FlujoAprobacion.activo == True)
        .order_by(models.FlujoAprobacion.id)
        .all()
    )

    cargo_norm = (cargo or "").strip().upper()
    flujo_especifico = None
    flujo_comodin = None

    for f in flujos:
        cargos = []
        if f.cargos_asociados:
            try:
                cargos = (
                    json.loads(f.cargos_asociados)
                    if isinstance(f.cargos_asociados, str)
                    else f.cargos_asociados
                )
            except Exception:
                cargos = []
        cargos_upper = [str(c).strip().upper() for c in cargos]

        if cargo_norm and cargo_norm in cargos_upper:
            flujo_especifico = f
            break

        if f.aplica_a_otros_cargos and not flujo_comodin:
            flujo_comodin = f

    return flujo_especifico or flujo_comodin or (flujos[0] if flujos else None)


@router.post("", response_model=schemas.AnticipoOut, status_code=201)
async def crear_anticipo(datos: schemas.AnticipoCreate, db: Session = Depends(get_db)):
    """
    Radica un nuevo anticipo, asigna inteligentemente el flujo según el cargo,
    genera la secuencia de pasos de aprobación y dispara la notificación por correo al primer aprobador.
    """
    # 1. Buscar email del solicitante si no vino
    email_solicitante = (datos.email_solicitante or "").strip()
    if not email_solicitante:
        email_solicitante = await _buscar_email_en_cronos(datos.nombre, datos.cedula)

    # 2. Evaluar flujo según el cargo
    flujo = _evaluar_flujo_para_cargo(db, datos.cargo or "")
    flujo_id = flujo.id if flujo else None
    flujo_nombre = flujo.nombre if flujo else "Flujo Estándar"
    pasos_definidos = flujo.pasos if flujo else []

    # 3. Consultar configuración de topes y evaluar si supera el tope
    config_tope = db.query(models.ConfiguracionTope).first()
    monto_tope_limite = float(config_tope.monto_tope) if config_tope else 1500000.0
    tope_activo = bool(config_tope.activo) if config_tope else True
    es_sobretope = tope_activo and (float(datos.valor) > monto_tope_limite)

    # 4. Crear el anticipo base
    anticipo_dict = datos.model_dump()
    anticipo_dict["email_solicitante"] = email_solicitante
    anticipo_dict["flujo_id"] = flujo_id
    anticipo_dict["flujo_nombre"] = flujo_nombre
    anticipo_dict["paso_actual"] = 1
    anticipo_dict["total_pasos"] = max(1, len(pasos_definidos))
    anticipo_dict["supera_tope"] = es_sobretope
    anticipo_dict["monto_tope_aplicado"] = Decimal(monto_tope_limite)

    if es_sobretope:
        anticipo_dict["estado"] = models.EstadoAnticipo.EN_AUTORIZACION_TOPE
        # Resolver email del autorizador de sobretope si no vino
        email_tope = (datos.autorizador_tope_email or "").strip()
        if not email_tope and datos.autorizador_tope_nombre:
            email_tope = await _buscar_email_en_cronos(datos.autorizador_tope_nombre)
        anticipo_dict["autorizador_tope_email"] = email_tope
    else:
        anticipo_dict["estado"] = models.EstadoAnticipo.PENDIENTE

    anticipo = models.Anticipo(**anticipo_dict)
    db.add(anticipo)
    db.flush()

    # 5. Generar la secuencia de pasos snapshot (AnticipoPasoProgreso)
    pasos_progreso_creados = []
    if pasos_definidos:
        for idx, p in enumerate(pasos_definidos, start=1):
            es_dinamico = bool(
                p.es_dinamico_solicitud
                or p.nombre_aprobador == "Persona seleccionada en la solicitud"
            )

            if es_dinamico:
                nombre_aprob = datos.director_autoriza
                cargo_aprob = "Autorizador de Solicitud"
                cedula_aprob = ""
                rol_aprob = p.rol_nivel or "Autorizador de la Solicitud"
                email_aprob = await _buscar_email_en_cronos(nombre_aprob)
            else:
                nombre_aprob = p.nombre_aprobador
                cargo_aprob = p.cargo_aprobador or ""
                cedula_aprob = p.cedula_aprobador or ""
                rol_aprob = p.rol_nivel or f"Paso {idx}"
                email_aprob = await _buscar_email_en_cronos(nombre_aprob, cedula_aprob)

            # Si es sobretope, todos los pasos arrancan en espera hasta que se apruebe el sobretope
            estado_inicial = "en_espera" if es_sobretope else ("pendiente" if idx == 1 else "en_espera")

            # Resolver aprobadores opcionales del paso
            opcionales_list = []
            if p.aprobadores_opcionales:
                try:
                    raw_list = json.loads(p.aprobadores_opcionales) if isinstance(p.aprobadores_opcionales, str) else p.aprobadores_opcionales
                    if isinstance(raw_list, list):
                        for item in raw_list:
                            opc_nombre = (item.get("nombre") or "").strip()
                            opc_cargo = (item.get("cargo") or "").strip()
                            opc_cedula = (item.get("cedula") or "").strip()
                            opc_email = (item.get("email") or "").strip()
                            if not opc_email and opc_nombre:
                                opc_email = await _buscar_email_en_cronos(opc_nombre, opc_cedula)
                            if opc_nombre:
                                opcionales_list.append({
                                    "nombre": opc_nombre,
                                    "cargo": opc_cargo,
                                    "cedula": opc_cedula,
                                    "email": opc_email,
                                })
                except Exception as ex_opc:
                    logger.warning(f"Error procesando aprobadores opcionales del paso {idx}: {ex_opc}")

            paso_prog = models.AnticipoPasoProgreso(
                anticipo_id=anticipo.id,
                orden=idx,
                nombre_aprobador=nombre_aprob,
                cargo_aprobador=cargo_aprob,
                cedula_aprobador=cedula_aprob,
                email_aprobador=email_aprob,
                rol_nivel=rol_aprob,
                es_dinamico=es_dinamico,
                estado=estado_inicial,
                aprobadores_opcionales=json.dumps(opcionales_list, ensure_ascii=False),
            )
            db.add(paso_prog)
            pasos_progreso_creados.append(paso_prog)
    else:
        # Si no había flujo configurado, generar paso único con el director que autoriza
        email_dir = await _buscar_email_en_cronos(datos.director_autoriza)
        estado_inicial = "en_espera" if es_sobretope else "pendiente"
        paso_prog = models.AnticipoPasoProgreso(
            anticipo_id=anticipo.id,
            orden=1,
            nombre_aprobador=datos.director_autoriza,
            cargo_aprobador="Autorizador Directo",
            cedula_aprobador="",
            email_aprobador=email_dir,
            rol_nivel="Autorizador de la Solicitud",
            es_dinamico=True,
            estado=estado_inicial,
            aprobadores_opcionales="[]",
        )
        db.add(paso_prog)
        pasos_progreso_creados.append(paso_prog)

    db.commit()
    db.refresh(anticipo)

    # 6. Notificaciones de inicio
    if es_sobretope:
        # Enviar correo de pre-autorización al autorizador de sobretope
        if anticipo.autorizador_tope_email:
            try:
                await mailer.notificar_solicitud_sobretope(
                    destinatario=anticipo.autorizador_tope_email,
                    autorizador_nombre=anticipo.autorizador_tope_nombre or "Autorizador de Sobretope",
                    anticipo_id=anticipo.id,
                    solicitante_nombre=anticipo.nombre,
                    solicitante_cargo=anticipo.cargo or "",
                    solicitante_cedula=anticipo.cedula,
                    centro_costo=anticipo.centro_costo,
                    obra=anticipo.obra,
                    valor=float(anticipo.valor),
                    monto_tope=monto_tope_limite,
                    motivo_tipo=anticipo.motivo_tipo or "compras",
                    motivo_detalle=anticipo.motivo_detalle or "",
                    justificacion=anticipo.justificacion or "",
                )
            except Exception as e:
                logger.error(f"Error enviando correo de sobretope: {e}")
    else:
        # Notificar por correo al primer aprobador (Paso 1) y confirmación al solicitante
        if pasos_progreso_creados:
            primer_paso = pasos_progreso_creados[0]
            
            # Extraer opcionales
            opcionales_data = []
            if primer_paso.aprobadores_opcionales:
                try:
                    opcionales_data = json.loads(primer_paso.aprobadores_opcionales) if isinstance(primer_paso.aprobadores_opcionales, str) else primer_paso.aprobadores_opcionales
                except Exception:
                    opcionales_data = []

            cc_list = [opc["email"] for opc in opcionales_data if opc.get("email")]
            nombres_opc = [
                f"{opc['nombre']} ({opc['cargo']})" if opc.get("cargo") else opc["nombre"]
                for opc in opcionales_data if opc.get("nombre")
            ]

            destinatario_principal = primer_paso.email_aprobador or (cc_list[0] if cc_list else "")
            cc_filtrada = [e for e in cc_list if e != destinatario_principal]

            if destinatario_principal:
                try:
                    await mailer.notificar_aprobador_turno(
                        destinatario=destinatario_principal,
                        nombre_aprobador=primer_paso.nombre_aprobador,
                        anticipo_id=anticipo.id,
                        solicitante_nombre=anticipo.nombre,
                        solicitante_cargo=anticipo.cargo or "",
                        solicitante_cedula=anticipo.cedula,
                        centro_costo=anticipo.centro_costo,
                        obra=anticipo.obra,
                        valor=float(anticipo.valor),
                        motivo_tipo=anticipo.motivo_tipo or "compras",
                        motivo_detalle=anticipo.motivo_detalle or "",
                        justificacion=anticipo.justificacion or "",
                        orden_paso=1,
                        total_pasos=anticipo.total_pasos,
                        rol_nivel=primer_paso.rol_nivel or "Aprobador",
                        cc_aprobadores_opcionales=cc_filtrada if cc_filtrada else None,
                        nombres_opcionales=nombres_opc if nombres_opc else None,
                    )
                except Exception as e:
                    logger.error(f"Error enviando correo de inicio de flujo: {e}")

            # Enviar confirmación de radicación al solicitante si tiene correo
            if anticipo.email_solicitante:
                try:
                    await mailer.notificar_radicacion_solicitante(
                        destinatario=anticipo.email_solicitante,
                        solicitante_nombre=anticipo.nombre,
                        anticipo_id=anticipo.id,
                        valor=float(anticipo.valor),
                        centro_costo=anticipo.centro_costo,
                        obra=anticipo.obra,
                        primer_aprobador_nombre=primer_paso.nombre_aprobador,
                        primer_aprobador_rol=primer_paso.rol_nivel or "Aprobador Paso 1",
                        total_pasos=anticipo.total_pasos,
                    )
                except Exception as e:
                    logger.error(f"Error enviando confirmación de radicación al solicitante: {e}")

    return anticipo


@router.post("/{anticipo_id}/aprobar-sobretope", response_model=schemas.AnticipoOut)
async def aprobar_sobretope_anticipo(
    anticipo_id: int,
    payload: schemas.AutorizarSobretopeRequest,
    db: Session = Depends(get_db),
):
    """
    Aprueba el sobretope de un anticipo en estado EN_AUTORIZACION_TOPE,
    activando el Paso 1 del flujo regular de aprobaciones y notificando por correo.
    """
    anticipo = (
        db.query(models.Anticipo)
        .options(joinedload(models.Anticipo.progreso_pasos))
        .filter(models.Anticipo.id == anticipo_id)
        .first()
    )
    if not anticipo:
        raise HTTPException(status_code=404, detail="Anticipo no encontrado")

    if anticipo.estado != models.EstadoAnticipo.EN_AUTORIZACION_TOPE:
        raise HTTPException(
            status_code=400,
            detail=f"Este anticipo no está pendiente de autorización de sobretope (Estado actual: '{anticipo.estado.value}').",
        )

    # 1. Marcar sobretope como autorizado
    anticipo.autorizado_tope = True
    anticipo.fecha_autorizacion_tope = datetime.now()
    anticipo.estado = models.EstadoAnticipo.PENDIENTE
    anticipo.paso_actual = 1

    # 2. Activar Paso 1
    primer_paso = next((p for p in anticipo.progreso_pasos if p.orden == 1), None)
    if primer_paso:
        primer_paso.estado = "pendiente"

    db.commit()
    db.refresh(anticipo)

    nombre_autorizador = payload.autorizador_nombre or anticipo.autorizador_tope_nombre or "Autorizador de Sobretope"

    # 3. Notificar al primer aprobador del flujo
    if primer_paso:
        opcionales_data = []
        if primer_paso.aprobadores_opcionales:
            try:
                opcionales_data = json.loads(primer_paso.aprobadores_opcionales) if isinstance(primer_paso.aprobadores_opcionales, str) else primer_paso.aprobadores_opcionales
            except Exception:
                opcionales_data = []

        cc_list = [opc["email"] for opc in opcionales_data if opc.get("email")]
        nombres_opc = [
            f"{opc['nombre']} ({opc['cargo']})" if opc.get("cargo") else opc["nombre"]
            for opc in opcionales_data if opc.get("nombre")
        ]

        destinatario_principal = primer_paso.email_aprobador or (cc_list[0] if cc_list else "")
        cc_filtrada = [e for e in cc_list if e != destinatario_principal]

        if destinatario_principal:
            try:
                await mailer.notificar_aprobador_turno(
                    destinatario=destinatario_principal,
                    nombre_aprobador=primer_paso.nombre_aprobador,
                    anticipo_id=anticipo.id,
                    solicitante_nombre=anticipo.nombre,
                    solicitante_cargo=anticipo.cargo or "",
                    solicitante_cedula=anticipo.cedula,
                    centro_costo=anticipo.centro_costo,
                    obra=anticipo.obra,
                    valor=float(anticipo.valor),
                    motivo_tipo=anticipo.motivo_tipo or "compras",
                    motivo_detalle=anticipo.motivo_detalle or "",
                    justificacion=anticipo.justificacion or "",
                    orden_paso=1,
                    total_pasos=anticipo.total_pasos,
                    rol_nivel=primer_paso.rol_nivel or "Aprobador",
                    cc_aprobadores_opcionales=cc_filtrada if cc_filtrada else None,
                    nombres_opcionales=nombres_opc if nombres_opc else None,
                )
            except Exception as e:
                logger.error(f"Error notificando al primer aprobador tras sobretope: {e}")

    # 4. Notificar al solicitante que el sobretope fue aprobado
    if anticipo.email_solicitante:
        try:
            await mailer.notificar_aprobacion_sobretope_solicitante(
                destinatario=anticipo.email_solicitante,
                solicitante_nombre=anticipo.nombre,
                anticipo_id=anticipo.id,
                autorizador_nombre=nombre_autorizador,
                valor=float(anticipo.valor),
                primer_aprobador_nombre=primer_paso.nombre_aprobador if primer_paso else "Aprobador Paso 1",
                primer_aprobador_rol=primer_paso.rol_nivel if primer_paso else "Paso 1",
            )
        except Exception as e:
            logger.error(f"Error enviando confirmación de sobretope al solicitante: {e}")

    return anticipo


@router.post("/{anticipo_id}/rechazar-sobretope", response_model=schemas.AnticipoOut)
async def rechazar_sobretope_anticipo(
    anticipo_id: int,
    payload: schemas.RechazarSobretopeRequest,
    db: Session = Depends(get_db),
):
    """
    Rechaza el sobretope de un anticipo en estado EN_AUTORIZACION_TOPE, detiene la solicitud y notifica al solicitante.
    """
    anticipo = (
        db.query(models.Anticipo)
        .options(joinedload(models.Anticipo.progreso_pasos))
        .filter(models.Anticipo.id == anticipo_id)
        .first()
    )
    if not anticipo:
        raise HTTPException(status_code=404, detail="Anticipo no encontrado")

    if anticipo.estado != models.EstadoAnticipo.EN_AUTORIZACION_TOPE:
        raise HTTPException(
            status_code=400,
            detail=f"Este anticipo no está pendiente de autorización de sobretope (Estado actual: '{anticipo.estado.value}').",
        )

    anticipo.autorizado_tope = False
    anticipo.fecha_autorizacion_tope = datetime.now()
    anticipo.motivo_rechazo_tope = payload.motivo
    anticipo.estado = models.EstadoAnticipo.RECHAZADO

    # Marcar pasos como en espera
    for p in anticipo.progreso_pasos:
        p.estado = "en_espera"

    db.commit()
    db.refresh(anticipo)

    # Notificar al solicitante
    if anticipo.email_solicitante:
        nombre_autorizador = payload.autorizador_nombre or anticipo.autorizador_tope_nombre or "Autorizador de Sobretope"
        try:
            await mailer.notificar_rechazo_sobretope(
                destinatario=anticipo.email_solicitante,
                solicitante_nombre=anticipo.nombre,
                anticipo_id=anticipo.id,
                autorizador_nombre=nombre_autorizador,
                valor=float(anticipo.valor),
                monto_tope=float(anticipo.monto_tope_aplicado or 1500000),
                motivo_rechazo=payload.motivo,
            )
        except Exception as e:
            logger.error(f"Error enviando correo de rechazo de sobretope al solicitante: {e}")

    return anticipo


@router.get("", response_model=list[schemas.AnticipoOut])
def listar_anticipos(db: Session = Depends(get_db)):
    return (
        db.query(models.Anticipo)
        .options(joinedload(models.Anticipo.progreso_pasos))
        .order_by(desc(models.Anticipo.created_at))
        .all()
    )


@router.get("/{anticipo_id}", response_model=schemas.AnticipoOut)
def obtener_anticipo(anticipo_id: int, db: Session = Depends(get_db)):
    anticipo = (
        db.query(models.Anticipo)
        .options(joinedload(models.Anticipo.progreso_pasos))
        .filter(models.Anticipo.id == anticipo_id)
        .first()
    )
    if anticipo is None:
        raise HTTPException(status_code=404, detail="Anticipo no encontrado")
    return anticipo


@router.get("/{anticipo_id}/pasos", response_model=list[schemas.AnticipoPasoProgresoOut])
def obtener_pasos_anticipo(anticipo_id: int, db: Session = Depends(get_db)):
    pasos = (
        db.query(models.AnticipoPasoProgreso)
        .filter(models.AnticipoPasoProgreso.anticipo_id == anticipo_id)
        .order_by(models.AnticipoPasoProgreso.orden)
        .all()
    )
    return pasos


@router.post("/{anticipo_id}/aprobar-paso", response_model=schemas.AnticipoOut)
async def aprobar_paso_anticipo(
    anticipo_id: int,
    payload: schemas.AprobarPasoRequest,
    db: Session = Depends(get_db),
):
    """
    Aprueba el paso actual en curso. Si es el último paso, aprueba completamente el anticipo.
    Si aún quedan pasos posteriores, avanza al siguiente paso y envía correo al siguiente aprobador y solicitante.
    """
    anticipo = (
        db.query(models.Anticipo)
        .options(joinedload(models.Anticipo.progreso_pasos))
        .filter(models.Anticipo.id == anticipo_id)
        .first()
    )
    if not anticipo:
        raise HTTPException(status_code=404, detail="Anticipo no encontrado")

    if anticipo.estado != models.EstadoAnticipo.PENDIENTE:
        raise HTTPException(
            status_code=400,
            detail=f"Este anticipo ya se encuentra en estado '{anticipo.estado.value}'.",
        )

    # Buscar paso actual
    paso_actual = next(
        (p for p in anticipo.progreso_pasos if p.orden == anticipo.paso_actual),
        None,
    )
    if not paso_actual:
        raise HTTPException(status_code=400, detail="No se encontró el paso actual en la secuencia.")

    # Marcar paso actual como aprobado
    paso_actual.estado = "aprobado"
    paso_actual.fecha_decision = datetime.now()
    paso_actual.comentario = payload.comentario or ""
    paso_actual.aprobado_por_nombre = payload.aprobador_nombre or paso_actual.nombre_aprobador
    paso_actual.aprobado_por_email = payload.aprobador_email or paso_actual.email_aprobador

    paso_aprobado_orden = anticipo.paso_actual
    nombre_quien_aprobo = paso_actual.aprobado_por_nombre

    # Verificar si hay siguiente paso
    if anticipo.paso_actual < anticipo.total_pasos:
        anticipo.paso_actual += 1
        siguiente_paso = next(
            (p for p in anticipo.progreso_pasos if p.orden == anticipo.paso_actual),
            None,
        )
        if siguiente_paso:
            siguiente_paso.estado = "pendiente"

        db.commit()
        db.refresh(anticipo)

        # 1. Disparar correo al siguiente aprobador
        if siguiente_paso:
            opcionales_data = []
            if siguiente_paso.aprobadores_opcionales:
                try:
                    opcionales_data = json.loads(siguiente_paso.aprobadores_opcionales) if isinstance(siguiente_paso.aprobadores_opcionales, str) else siguiente_paso.aprobadores_opcionales
                except Exception:
                    opcionales_data = []

            cc_list = [opc["email"] for opc in opcionales_data if opc.get("email")]
            nombres_opc = [
                f"{opc['nombre']} ({opc['cargo']})" if opc.get("cargo") else opc["nombre"]
                for opc in opcionales_data if opc.get("nombre")
            ]

            destinatario_principal = siguiente_paso.email_aprobador or (cc_list[0] if cc_list else "")
            cc_filtrada = [e for e in cc_list if e != destinatario_principal]

            if destinatario_principal:
                try:
                    await mailer.notificar_aprobador_turno(
                        destinatario=destinatario_principal,
                        nombre_aprobador=siguiente_paso.nombre_aprobador,
                        anticipo_id=anticipo.id,
                        solicitante_nombre=anticipo.nombre,
                        solicitante_cargo=anticipo.cargo or "",
                        solicitante_cedula=anticipo.cedula,
                        centro_costo=anticipo.centro_costo,
                        obra=anticipo.obra,
                        valor=float(anticipo.valor),
                        motivo_tipo=anticipo.motivo_tipo or "compras",
                        motivo_detalle=anticipo.motivo_detalle or "",
                        justificacion=anticipo.justificacion or "",
                        orden_paso=siguiente_paso.orden,
                        total_pasos=anticipo.total_pasos,
                        rol_nivel=siguiente_paso.rol_nivel or "Aprobador",
                        cc_aprobadores_opcionales=cc_filtrada if cc_filtrada else None,
                        nombres_opcionales=nombres_opc if nombres_opc else None,
                    )
                except Exception as e:
                    logger.error(f"Error notificando al siguiente aprobador: {e}")

        # 2. Notificar avance de paso al solicitante
        if anticipo.email_solicitante and siguiente_paso:
            try:
                await mailer.notificar_avance_solicitante(
                    destinatario=anticipo.email_solicitante,
                    solicitante_nombre=anticipo.nombre,
                    anticipo_id=anticipo.id,
                    valor=float(anticipo.valor),
                    paso_aprobado_num=paso_aprobado_orden,
                    total_pasos=anticipo.total_pasos,
                    nombre_quien_aprobo=nombre_quien_aprobo,
                    siguiente_aprobador_nombre=siguiente_paso.nombre_aprobador,
                    siguiente_rol_nivel=siguiente_paso.rol_nivel or "Siguiente Aprobador",
                )
            except Exception as e:
                logger.error(f"Error enviando correo de avance al solicitante: {e}")

    else:
        # Aprobación final total (se completó el último paso del flujo)
        anticipo.estado = models.EstadoAnticipo.APROBADO
        db.commit()
        db.refresh(anticipo)

        flujo = db.get(models.FlujoAprobacion, anticipo.flujo_id) if anticipo.flujo_id else None

        # 1. Notificación final al solicitante
        if anticipo.email_solicitante:
            try:
                await mailer.notificar_aprobacion_final_solicitante(
                    destinatario=anticipo.email_solicitante,
                    solicitante_nombre=anticipo.nombre,
                    anticipo_id=anticipo.id,
                    valor=float(anticipo.valor),
                    centro_costo=anticipo.centro_costo,
                    obra=anticipo.obra,
                )
            except Exception as e:
                logger.error(f"Error enviando correo de aprobación final al solicitante: {e}")

        # 2. Notificación dedicada al responsable configurado en el flujo para desembolso / recaudo
        if flujo and flujo.notificar_a_email:
            try:
                pasos_historial = [
                    {
                        "orden": p.orden,
                        "rol_nivel": p.rol_nivel or f"Paso {p.orden}",
                        "aprobador": p.aprobado_por_nombre or p.nombre_aprobador,
                        "fecha": p.fecha_decision.strftime("%d/%m/%Y %H:%M") if p.fecha_decision else "Aprobado",
                        "comentario": p.comentario or "",
                    }
                    for p in sorted(anticipo.progreso_pasos, key=lambda x: x.orden)
                ]

                await mailer.notificar_responsable_flujo_final(
                    destinatario=flujo.notificar_a_email,
                    nombre_responsable=flujo.notificar_a_nombre or "Responsable de Pagos / Tesorería",
                    cargo_responsable=flujo.notificar_a_cargo or "Tesorería / Recaudo",
                    anticipo_id=anticipo.id,
                    solicitante_nombre=anticipo.nombre,
                    solicitante_cedula=anticipo.cedula,
                    solicitante_cargo=anticipo.cargo or "",
                    solicitante_empresa=anticipo.empresa or "",
                    valor=float(anticipo.valor),
                    centro_costo=anticipo.centro_costo,
                    obra=anticipo.obra,
                    motivo_tipo=anticipo.motivo_tipo or "compras",
                    motivo_detalle=anticipo.motivo_detalle or "",
                    justificacion=anticipo.justificacion or "",
                    flujo_nombre=anticipo.flujo_nombre or flujo.nombre,
                    pasos_historial=pasos_historial,
                )
            except Exception as e:
                logger.error(f"Error notificando al responsable final del flujo: {e}")

    return anticipo


@router.post("/{anticipo_id}/rechazar-paso", response_model=schemas.AnticipoOut)
async def rechazar_paso_anticipo(
    anticipo_id: int,
    payload: schemas.RechazarPasoRequest,
    db: Session = Depends(get_db),
):
    """
    Rechaza el anticipo en el paso actual y detiene el flujo, notificando al solicitante.
    """
    anticipo = (
        db.query(models.Anticipo)
        .options(joinedload(models.Anticipo.progreso_pasos))
        .filter(models.Anticipo.id == anticipo_id)
        .first()
    )
    if not anticipo:
        raise HTTPException(status_code=404, detail="Anticipo no encontrado")

    if anticipo.estado != models.EstadoAnticipo.PENDIENTE:
        raise HTTPException(
            status_code=400,
            detail=f"Este anticipo ya se encuentra en estado '{anticipo.estado.value}'.",
        )

    # Buscar paso actual
    paso_actual = next(
        (p for p in anticipo.progreso_pasos if p.orden == anticipo.paso_actual),
        None,
    )
    if paso_actual:
        paso_actual.estado = "rechazado"
        paso_actual.fecha_decision = datetime.now()
        paso_actual.comentario = payload.motivo
        paso_actual.aprobado_por_nombre = payload.aprobador_nombre or paso_actual.nombre_aprobador
        paso_actual.aprobado_por_email = payload.aprobador_email or paso_actual.email_aprobador

    anticipo.estado = models.EstadoAnticipo.RECHAZADO
    db.commit()
    db.refresh(anticipo)

    # Disparar correo de rechazo al solicitante
    if anticipo.email_solicitante:
        aprobador_str = payload.aprobador_nombre or (paso_actual.nombre_aprobador if paso_actual else "Aprobador")
        paso_num = paso_actual.orden if paso_actual else 1
        try:
            await mailer.notificar_rechazo(
                destinatario=anticipo.email_solicitante,
                solicitante_nombre=anticipo.nombre,
                anticipo_id=anticipo.id,
                aprobador_rechaza=aprobador_str,
                motivo_rechazo=payload.motivo,
                paso_rechazado_orden=paso_num,
                total_pasos=anticipo.total_pasos,
            )
        except Exception as e:
            logger.error(f"Error enviando correo de rechazo: {e}")

    return anticipo


@router.post("/{anticipo_id}/legalizar", response_model=schemas.AnticipoOut)
def legalizar_anticipo(
    anticipo_id: int,
    payload: schemas.LegalizarAnticipoRequest,
    db: Session = Depends(get_db),
):
    """
    Registra el recaudo / legalización de un anticipo, guardando el monto legalizado y observaciones.
    """
    anticipo = (
        db.query(models.Anticipo)
        .options(joinedload(models.Anticipo.progreso_pasos))
        .filter(models.Anticipo.id == anticipo_id)
        .first()
    )
    if not anticipo:
        raise HTTPException(status_code=404, detail="Anticipo no encontrado")

    anticipo.legalizado = payload.legalizado
    if payload.monto_legalizado is not None:
        anticipo.monto_legalizado = payload.monto_legalizado
    else:
        anticipo.monto_legalizado = anticipo.valor if payload.legalizado else 0

    anticipo.fecha_legalizacion = datetime.now() if payload.legalizado else None
    anticipo.legalizado_por = payload.legalizado_por or ""
    anticipo.observaciones_legalizacion = payload.observaciones or ""

    db.commit()
    db.refresh(anticipo)
    return anticipo


@router.delete("/{anticipo_id}", status_code=200)
def eliminar_anticipo(anticipo_id: int, db: Session = Depends(get_db)):
    """
    Elimina permanentemente una solicitud de anticipo y sus pasos de progreso asociados.
    """
    anticipo = db.query(models.Anticipo).filter(models.Anticipo.id == anticipo_id).first()
    if not anticipo:
        raise HTTPException(status_code=404, detail="Anticipo no encontrado")

    db.delete(anticipo)
    db.commit()
    return {"mensaje": "Solicitud eliminada exitosamente", "id": anticipo_id}

