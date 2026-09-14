import { useEffect, useState, useMemo } from "react";
import {
  listarAnticipos,
  aprobarPasoAnticipo,
  rechazarPasoAnticipo,
  aprobarSobretopeAnticipo,
  rechazarSobretopeAnticipo,
} from "../api";
import { useAuth } from "../context/AuthContext";

const formatoMoneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function Aprobaciones() {
  const { user } = useAuth();
  const [anticipos, setAnticipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [busqueda, setBusqueda] = useState("");
  const [notificacion, setNotificacion] = useState(null);

  // Modales de Aprobación / Rechazo / Detalle
  const [modalAprobar, setModalAprobar] = useState(null);
  const [modalRechazar, setModalRechazar] = useState(null);
  const [modalDetalle, setModalDetalle] = useState(null);
  const [modalAprobarSobretope, setModalAprobarSobretope] = useState(null);
  const [modalRechazarSobretope, setModalRechazarSobretope] = useState(null);
  const [comentarioAprobacion, setComentarioAprobacion] = useState("");
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [motivoRechazoSobretope, setMotivoRechazoSobretope] = useState("");
  const [procesandoAccion, setProcesandoAccion] = useState(false);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const data = await listarAnticipos();
      setAnticipos(data);
      setError(null);
    } catch (err) {
      console.error("Error al cargar anticipos:", err);
      setError("No se pudieron cargar los anticipos para aprobación.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const mostrarNotif = (tipo, mensaje) => {
    setNotificacion({ tipo, mensaje });
    setTimeout(() => setNotificacion(null), 4000);
  };

  // Ejecutar Aprobación de Paso Normal
  const handleAprobarPaso = async () => {
    if (!modalAprobar) return;
    try {
      setProcesandoAccion(true);
      await aprobarPasoAnticipo(modalAprobar.id, {
        comentario: comentarioAprobacion.trim(),
        aprobador_nombre: user?.name || "",
        aprobador_email: user?.email || "",
      });

      mostrarNotif("exito", `¡Paso del Anticipo #${modalAprobar.id} aprobado con éxito!`);
      setModalAprobar(null);
      setComentarioAprobacion("");
      await cargarDatos();
    } catch (err) {
      console.error("Error aprobando paso:", err);
      mostrarNotif("error", err.message || "Error al procesar la aprobación.");
    } finally {
      setProcesandoAccion(false);
    }
  };

  // Ejecutar Rechazo de Paso Normal
  const handleRechazarPaso = async () => {
    if (!modalRechazar) return;
    if (!motivoRechazo.trim()) {
      alert("Por favor indica el motivo del rechazo.");
      return;
    }

    try {
      setProcesandoAccion(true);
      await rechazarPasoAnticipo(modalRechazar.id, {
        motivo: motivoRechazo.trim(),
        aprobador_nombre: user?.name || "",
        aprobador_email: user?.email || "",
      });

      mostrarNotif("exito", `Anticipo #${modalRechazar.id} rechazado.`);
      setModalRechazar(null);
      setMotivoRechazo("");
      await cargarDatos();
    } catch (err) {
      console.error("Error rechazando anticipo:", err);
      mostrarNotif("error", err.message || "Error al rechazar el anticipo.");
    } finally {
      setProcesandoAccion(false);
    }
  };

  // Ejecutar Aprobación de Sobretope
  const handleAprobarSobretope = async () => {
    if (!modalAprobarSobretope) return;
    try {
      setProcesandoAccion(true);
      await aprobarSobretopeAnticipo(modalAprobarSobretope.id, {
        autorizador_nombre: user?.name || modalAprobarSobretope.autorizador_tope_nombre || "",
        autorizador_email: user?.email || modalAprobarSobretope.autorizador_tope_email || "",
      });

      mostrarNotif("exito", `¡Sobretope del Anticipo #${modalAprobarSobretope.id} autorizado con éxito! Ahora iniciará el flujo de aprobación.`);
      setModalAprobarSobretope(null);
      await cargarDatos();
    } catch (err) {
      console.error("Error autorizando sobretope:", err);
      mostrarNotif("error", err.message || "Error al autorizar el sobretope.");
    } finally {
      setProcesandoAccion(false);
    }
  };

  // Ejecutar Rechazo de Sobretope
  const handleRechazarSobretope = async () => {
    if (!modalRechazarSobretope) return;
    if (!motivoRechazoSobretope.trim()) {
      alert("Por favor indica el motivo del rechazo de sobretope.");
      return;
    }

    try {
      setProcesandoAccion(true);
      await rechazarSobretopeAnticipo(modalRechazarSobretope.id, {
        motivo: motivoRechazoSobretope.trim(),
        autorizador_nombre: user?.name || modalRechazarSobretope.autorizador_tope_nombre || "",
        autorizador_email: user?.email || modalRechazarSobretope.autorizador_tope_email || "",
      });

      mostrarNotif("exito", `Sobretope del Anticipo #${modalRechazarSobretope.id} rechazado.`);
      setModalRechazarSobretope(null);
      setMotivoRechazoSobretope("");
      await cargarDatos();
    } catch (err) {
      console.error("Error rechazando sobretope:", err);
      mostrarNotif("error", err.message || "Error al rechazar el sobretope.");
    } finally {
      setProcesandoAccion(false);
    }
  };

  // Filtrado de Anticipos
  const anticiposFiltrados = useMemo(() => {
    let lista = anticipos;

    if (filtroEstado !== "todos") {
      lista = lista.filter((a) => a.estado === filtroEstado);
    }

    const q = busqueda.toLowerCase().trim();
    if (q) {
      lista = lista.filter(
        (a) =>
          a.nombre.toLowerCase().includes(q) ||
          a.cedula.toLowerCase().includes(q) ||
          a.obra.toLowerCase().includes(q) ||
          a.centro_costo.toLowerCase().includes(q) ||
          (a.flujo_nombre && a.flujo_nombre.toLowerCase().includes(q))
      );
    }

    return lista;
  }, [anticipos, filtroEstado, busqueda]);

  // Contadores para KPIs
  const conteoPendientes = useMemo(() => anticipos.filter((a) => a.estado === "pendiente").length, [anticipos]);
  const conteoSobretope = useMemo(() => anticipos.filter((a) => a.estado === "en_autorizacion_tope").length, [anticipos]);
  const conteoAprobados = useMemo(() => anticipos.filter((a) => a.estado === "aprobado").length, [anticipos]);
  const conteoRechazados = useMemo(() => anticipos.filter((a) => a.estado === "rechazado").length, [anticipos]);

  return (
    <div className="aprobaciones-page">
      {/* Toast Notification */}
      {notificacion && (
        <div className={`toast-alerta toast-${notificacion.tipo}`}>
          <span>{notificacion.tipo === "exito" ? "✅" : "⚠️"}</span>
          <span>{notificacion.mensaje}</span>
        </div>
      )}

      {/* Encabezado */}
      <div className="pagina-encabezado">
        <div>
          <h2>Bandeja de Aprobaciones Multinivel</h2>
          <p>
            Gestión inteligente de aprobaciones por cargos, autorización de sobretopes y notificaciones vía Microsoft Graph API.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="colaboradores-kpis">
        <div
          className={`kpi-card ${filtroEstado === "pendiente" ? "kpi-seleccionado" : ""}`}
          onClick={() => setFiltroEstado("pendiente")}
          style={{ cursor: "pointer" }}
        >
          <div className="kpi-icono">⏳</div>
          <div className="kpi-info">
            <span className="kpi-valor">{conteoPendientes}</span>
            <span className="kpi-label">Pendientes de Flujo</span>
          </div>
        </div>

        <div
          className={`kpi-card ${filtroEstado === "en_autorizacion_tope" ? "kpi-seleccionado" : ""}`}
          onClick={() => setFiltroEstado("en_autorizacion_tope")}
          style={{ cursor: "pointer" }}
        >
          <div className="kpi-icono">⚠️</div>
          <div className="kpi-info">
            <span className="kpi-valor">{conteoSobretope}</span>
            <span className="kpi-label">Requiere Sobretope</span>
          </div>
        </div>

        <div
          className={`kpi-card ${filtroEstado === "aprobado" ? "kpi-seleccionado" : ""}`}
          onClick={() => setFiltroEstado("aprobado")}
          style={{ cursor: "pointer" }}
        >
          <div className="kpi-icono">✅</div>
          <div className="kpi-info">
            <span className="kpi-valor">{conteoAprobados}</span>
            <span className="kpi-label">Totalmente Aprobados</span>
          </div>
        </div>

        <div
          className={`kpi-card ${filtroEstado === "rechazado" ? "kpi-seleccionado" : ""}`}
          onClick={() => setFiltroEstado("rechazado")}
          style={{ cursor: "pointer" }}
        >
          <div className="kpi-icono">❌</div>
          <div className="kpi-info">
            <span className="kpi-valor">{conteoRechazados}</span>
            <span className="kpi-label">Rechazados</span>
          </div>
        </div>

        <div
          className={`kpi-card ${filtroEstado === "todos" ? "kpi-seleccionado" : ""}`}
          onClick={() => setFiltroEstado("todos")}
          style={{ cursor: "pointer" }}
        >
          <div className="kpi-icono">📋</div>
          <div className="kpi-info">
            <span className="kpi-valor">{anticipos.length}</span>
            <span className="kpi-label">Total de Solicitudes</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="colab-busqueda-bar" style={{ marginTop: "1.5rem" }}>
        <div className="input-busqueda-icono">
          <span>🔍</span>
          <input
            type="text"
            placeholder="Buscar por solicitante, cédula, obra, centro de costo o flujo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button className="btn-limpiar" onClick={() => setBusqueda("")}>
              ✕
            </button>
          )}
        </div>

        <div className="filtro-estado-botones">
          <button
            className={`btn-filtro-tag ${filtroEstado === "pendiente" ? "activo" : ""}`}
            onClick={() => setFiltroEstado("pendiente")}
          >
            Pendientes ({conteoPendientes})
          </button>
          <button
            className={`btn-filtro-tag ${filtroEstado === "en_autorizacion_tope" ? "activo" : ""}`}
            onClick={() => setFiltroEstado("en_autorizacion_tope")}
          >
            Sobretope ({conteoSobretope})
          </button>
          <button
            className={`btn-filtro-tag ${filtroEstado === "aprobado" ? "activo" : ""}`}
            onClick={() => setFiltroEstado("aprobado")}
          >
            Aprobados ({conteoAprobados})
          </button>
          <button
            className={`btn-filtro-tag ${filtroEstado === "rechazado" ? "activo" : ""}`}
            onClick={() => setFiltroEstado("rechazado")}
          >
            Rechazados ({conteoRechazados})
          </button>
          <button
            className={`btn-filtro-tag ${filtroEstado === "todos" ? "activo" : ""}`}
            onClick={() => setFiltroEstado("todos")}
          >
            Todos ({anticipos.length})
          </button>
        </div>
      </div>

      {/* Contenido Principal / Lista de Tarjetas de Aprobación */}
      {cargando ? (
        <div className="colaboradores-cargando">
          <div className="spinner"></div>
          <p>Cargando bandeja de aprobaciones...</p>
        </div>
      ) : error ? (
        <p className="mensaje mensaje-error">{error}</p>
      ) : anticiposFiltrados.length === 0 ? (
        <div className="flujo-timeline-vacio" style={{ marginTop: "1.5rem" }}>
          <p>No hay solicitudes que coincidan con los filtros aplicados.</p>
        </div>
      ) : (
        <div className="aprobaciones-grid-lista">
          {anticiposFiltrados.map((a) => {
            return (
              <div key={a.id} className={`aprobacion-card-item estado-${a.estado}`}>
                <div className="aprobacion-card-header">
                  <div className="aprobacion-id-badge">
                    <span className="id-num">#{a.id}</span>
                    <span className={`badge-estado-pill pill-${a.estado}`}>
                      {a.estado === "pendiente"
                        ? `⏳ En Nivel ${a.paso_actual}/${a.total_pasos}`
                        : a.estado === "en_autorizacion_tope"
                        ? "⚠️ Requiere Sobretope"
                        : a.estado === "aprobado"
                        ? "✅ Aprobado Total"
                        : "❌ Rechazado"}
                    </span>
                  </div>
                  <span className="aprobacion-fecha">
                    {new Date(a.created_at).toLocaleDateString("es-CO", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="aprobacion-card-body">
                  <div className="aprobacion-info-fila">
                    <div className="solicitante-bloque">
                      <span className="solicitante-nombre">👤 {a.nombre}</span>
                      <span className="solicitante-sub">
                        CC: {a.cedula} &middot; {a.cargo || "Sin cargo"} {a.empresa ? `(${a.empresa})` : ""}
                      </span>
                    </div>
                    <div className="monto-bloque">
                      <span className="monto-valor">{formatoMoneda.format(a.valor)}</span>
                    </div>
                  </div>

                  {a.estado === "en_autorizacion_tope" && (
                    <div className="alerta-sobretope-card" style={{
                      marginTop: "0.75rem",
                      padding: "0.75rem 1rem",
                      background: "rgba(245, 158, 11, 0.12)",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      borderRadius: "8px",
                      display: "flex",
                      gap: "0.6rem",
                      alignItems: "flex-start",
                      fontSize: "0.85rem"
                    }}>
                      <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                      <div>
                        <strong style={{ color: "#d97706" }}>Excede el tope estándar ({formatoMoneda.format(a.monto_tope_aplicado || 1500000)})</strong>
                        <p style={{ margin: "2px 0 0 0", color: "var(--text-secondary)" }}>
                          Autorizador designado: <strong>{a.autorizador_tope_nombre || "Autorizador"}</strong> {a.autorizador_tope_cargo ? `(${a.autorizador_tope_cargo})` : ""}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="aprobacion-detalles-meta">
                    <div className="meta-item">
                      <span className="meta-label">Obra / Centro:</span>
                      <span className="meta-val">🏗️ {a.obra} ({a.centro_costo})</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Motivo:</span>
                      <span className="meta-val">
                        {a.motivo_tipo === "compras" ? "🛍️ Compras" : "🚚 Transporte"} &middot; {a.motivo_detalle || a.obra_destino || a.justificacion || "Sin detalle adicional"}
                      </span>
                    </div>
                  </div>

                  {/* LÍNEA DE TIEMPO VISUAL DE PASOS DE APROBACIÓN */}
                  <div className="aprobacion-flujo-timeline-box">
                    <div className="timeline-titulo-bar">
                      <span>⛓️ Flujo: <strong>{a.flujo_nombre || "Flujo Corporativo"}</strong></span>
                      <span className="timeline-progreso-txt">
                        {a.estado === "en_autorizacion_tope"
                          ? "En espera de sobretope"
                          : `Nivel ${a.paso_actual} de ${a.total_pasos}`}
                      </span>
                    </div>

                    <div className="aprobacion-pasos-stepper">
                      {a.progreso_pasos?.map((paso, idx) => {
                        const esCompletado = paso.estado === "aprobado";
                        const esActual = a.estado === "pendiente" && paso.orden === a.paso_actual;
                        const esRechazado = paso.estado === "rechazado";

                        return (
                          <div
                            key={paso.id || idx}
                            className={`stepper-paso-chip ${
                              esCompletado
                                ? "paso-completado"
                                : esActual
                                ? "paso-activo"
                                : esRechazado
                                ? "paso-rechazado"
                                : "paso-espera"
                            }`}
                          >
                            <div className="paso-chip-icono">
                              {esCompletado ? "✓" : esRechazado ? "✕" : esActual ? "⚡" : paso.orden}
                            </div>
                            <div className="paso-chip-texto">
                              <strong>Paso {paso.orden}: {paso.rol_nivel || "Aprobador"}</strong>
                              <span>{paso.nombre_aprobador}</span>
                              {paso.aprobadores_opcionales && paso.aprobadores_opcionales.length > 0 && (
                                <span className="paso-suplentes-txt">
                                  👥 Suplentes: {paso.aprobadores_opcionales.map((o) => o.nombre).join(", ")}
                                </span>
                              )}
                              {paso.fecha_decision && (
                                <span className="paso-fecha-dec">
                                  {new Date(paso.fecha_decision).toLocaleDateString("es-CO", {
                                    month: "numeric",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Acciones de la Tarjeta */}
                <div className="aprobacion-card-footer">
                  <button
                    className="btn-ver-detalle"
                    onClick={() => setModalDetalle(a)}
                  >
                    🔍 Ver Detalle
                  </button>

                  {a.estado === "en_autorizacion_tope" && (
                    <div className="acciones-decision-btn">
                      <button
                        className="btn-accion-rechazar"
                        onClick={() => setModalRechazarSobretope(a)}
                      >
                        ✕ Rechazar Sobretope
                      </button>
                      <button
                        className="btn-accion-aprobar"
                        style={{ background: "#d97706", borderColor: "#b45309" }}
                        onClick={() => setModalAprobarSobretope(a)}
                      >
                        ✓ Autorizar Sobretope
                      </button>
                    </div>
                  )}

                  {a.estado === "pendiente" && (
                    <div className="acciones-decision-btn">
                      <button
                        className="btn-accion-rechazar"
                        onClick={() => setModalRechazar(a)}
                      >
                        ✕ Rechazar
                      </button>
                      <button
                        className="btn-accion-aprobar"
                        onClick={() => setModalAprobar(a)}
                      >
                        ✓ Aprobar Nivel {a.paso_actual}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE APROBAR PASO */}
      {modalAprobar && (() => {
        const pasoAct = modalAprobar.progreso_pasos?.find((p) => p.orden === modalAprobar.paso_actual);
        return (
          <div className="modal-overlay">
            <div className="modal-contenido modal-sm">
              <div className="modal-header">
                <h3>✅ Aprobar Nivel {modalAprobar.paso_actual}</h3>
                <button className="btn-cerrar-modal" onClick={() => setModalAprobar(null)}>✕</button>
              </div>
              <div className="modal-body">
                <p>
                  ¿Confirmas la aprobación del <strong>Paso {modalAprobar.paso_actual}</strong> para el anticipo <strong>#{modalAprobar.id}</strong> solicitado por <strong>{modalAprobar.nombre}</strong> por valor de <strong>{formatoMoneda.format(modalAprobar.valor)}</strong>?
                </p>

                {pasoAct && (
                  <div className="alerta-aprobadores-info" style={{ margin: "0.8rem 0", padding: "0.6rem 0.8rem", background: "var(--bg-tertiary)", borderRadius: "8px", fontSize: "0.85rem" }}>
                    <div><strong>Aprobador principal:</strong> {pasoAct.nombre_aprobador}</div>
                    {pasoAct.aprobadores_opcionales && pasoAct.aprobadores_opcionales.length > 0 && (
                      <div style={{ marginTop: "0.3rem" }}>
                        <strong>Suplentes autorizados:</strong>{" "}
                        {pasoAct.aprobadores_opcionales.map((o) => o.nombre).join(", ")}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="campo-form-modal">
                  <label>Comentarios u Observaciones (Opcional):</label>
                  <textarea
                    rows="3"
                    value={comentarioAprobacion}
                    onChange={(e) => setComentarioAprobacion(e.target.value)}
                    placeholder="Escribe algún comentario o visto bueno..."
                  />
                </div>

                {modalAprobar.paso_actual < modalAprobar.total_pasos ? (
                  <div className="alerta-info-modal">
                    ℹ️ Al aprobar este nivel, el sistema avanzará automáticamente al <strong>Paso {modalAprobar.paso_actual + 1}</strong> y le notificará por correo al siguiente aprobador y a sus suplentes.
                  </div>
                ) : (
                  <div className="alerta-exito-modal">
                    🎉 Este es el <strong>último paso</strong> del flujo. Al aprobarlo, el anticipo quedará <strong>Totalmente Aprobado</strong> para desembolso y se notificará al solicitante y a tesorería.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn-cancelar-modal" onClick={() => setModalAprobar(null)}>
                  Cancelar
                </button>
                <button
                  className="btn-confirmar-aprobar"
                  onClick={handleAprobarPaso}
                  disabled={procesandoAccion}
                >
                  {procesandoAccion ? "Aprobando..." : "Confirmar Aprobación"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL DE RECHAZAR PASO */}
      {modalRechazar && (
        <div className="modal-overlay">
          <div className="modal-contenido modal-sm">
            <div className="modal-header header-rechazo">
              <h3>❌ Rechazar Solicitud #{modalRechazar.id}</h3>
              <button className="btn-cerrar-modal" onClick={() => setModalRechazar(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>
                Indica el motivo por el cual rechazas esta solicitud de <strong>{modalRechazar.nombre}</strong>. Este motivo le será enviado por correo al solicitante.
              </p>

              <div className="campo-form-modal">
                <label>Motivo del Rechazo (Obligatorio):</label>
                <textarea
                  rows="3"
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  placeholder="Especifica claramente la razón del rechazo..."
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancelar-modal" onClick={() => setModalRechazar(null)}>
                Cancelar
              </button>
              <button
                className="btn-confirmar-rechazar"
                onClick={handleRechazarPaso}
                disabled={procesandoAccion || !motivoRechazo.trim()}
              >
                {procesandoAccion ? "Rechazando..." : "Confirmar Rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DETALLE COMPLETO */}
      {modalDetalle && (
        <div className="modal-overlay">
          <div className="modal-contenido modal-md">
            <div className="modal-header">
              <h3>📄 Detalle Completo del Anticipo #{modalDetalle.id}</h3>
              <button className="btn-cerrar-modal" onClick={() => setModalDetalle(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="detalle-modal-grid">
                <div className="detalle-modal-seccion">
                  <h4>Datos del Solicitante</h4>
                  <div className="fila-detalle-modal"><span>Nombre:</span><strong>{modalDetalle.nombre}</strong></div>
                  <div className="fila-detalle-modal"><span>Cédula:</span><strong>{modalDetalle.cedula}</strong></div>
                  <div className="fila-detalle-modal"><span>Cargo:</span><strong>{modalDetalle.cargo || "N/A"}</strong></div>
                  <div className="fila-detalle-modal"><span>Empresa:</span><strong>{modalDetalle.empresa || "N/A"}</strong></div>
                  <div className="fila-detalle-modal"><span>Correo:</span><strong>{modalDetalle.email_solicitante || "N/A"}</strong></div>
                </div>

                <div className="detalle-modal-seccion">
                  <h4>Datos del Anticipo</h4>
                  <div className="fila-detalle-modal"><span>Obra / Centro:</span><strong>{modalDetalle.obra} ({modalDetalle.centro_costo})</strong></div>
                  <div className="fila-detalle-modal"><span>Valor:</span><strong className="monto-resaltado">{formatoMoneda.format(modalDetalle.valor)}</strong></div>
                  <div className="fila-detalle-modal"><span>Motivo:</span><strong>{modalDetalle.motivo_tipo === "compras" ? "Compras" : "Transporte"}</strong></div>
                  <div className="fila-detalle-modal"><span>Detalle / Destino:</span><strong>{modalDetalle.motivo_detalle || modalDetalle.obra_destino || "N/A"}</strong></div>
                  {modalDetalle.justificacion && (
                    <div className="fila-detalle-modal"><span>Justificación:</span><strong>{modalDetalle.justificacion}</strong></div>
                  )}
                  {modalDetalle.supera_tope && (
                    <div className="fila-detalle-modal" style={{ marginTop: "0.5rem", padding: "0.5rem", background: "rgba(245, 158, 11, 0.1)", borderRadius: "6px" }}>
                      <span>⚠️ Sobretope:</span>
                      <div>
                        <strong style={{ color: "#d97706" }}>Tope: {formatoMoneda.format(modalDetalle.monto_tope_aplicado || 1500000)}</strong>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                          Autorizador: {modalDetalle.autorizador_tope_nombre || "N/A"}
                          {modalDetalle.autorizado_tope ? " (✓ Autorizado)" : modalDetalle.motivo_rechazo_tope ? " (✕ Rechazado)" : " (⏳ Pendiente de autorización)"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {modalDetalle.firma && (
                <div className="detalle-firma-box">
                  <h4>Firma del Solicitante</h4>
                  <img src={modalDetalle.firma} alt="Firma del solicitante" className="img-firma-modal" />
                </div>
              )}

              <div className="detalle-pasos-completo">
                <h4>Historial de Pasos de Aprobación</h4>
                <div className="tabla-pasos-modal">
                  {modalDetalle.progreso_pasos?.map((p) => (
                    <div key={p.id || p.orden} className={`fila-paso-historial estado-paso-${p.estado}`}>
                      <span className="paso-num-col">Paso {p.orden}</span>
                      <div className="paso-info-col">
                        <strong>{p.nombre_aprobador}</strong>
                        <span>{p.rol_nivel || "Aprobador"}</span>
                        {p.aprobadores_opcionales && p.aprobadores_opcionales.length > 0 && (
                          <span className="paso-suplentes-txt" style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                            👥 Suplentes autorizados: {p.aprobadores_opcionales.map((o) => o.nombre).join(", ")}
                          </span>
                        )}
                        {p.aprobado_por_nombre && p.aprobado_por_nombre !== p.nombre_aprobador && (
                          <span style={{ display: "inline-block", fontSize: "0.75rem", background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", padding: "1px 6px", borderRadius: "4px", marginTop: "4px" }}>
                            👤 Aprobado por suplente: {p.aprobado_por_nombre}
                          </span>
                        )}
                        {p.comentario && <p className="paso-comentario-txt">"{p.comentario}"</p>}
                      </div>
                      <span className={`badge-estado-sm estado-${p.estado}`}>
                        {p.estado === "aprobado" ? "✓ Aprobado" : p.estado === "rechazado" ? "✕ Rechazado" : p.estado === "pendiente" ? "⏳ Pendiente" : "En espera"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancelar-modal" onClick={() => setModalDetalle(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AUTORIZAR SOBRETOPE */}
      {modalAprobarSobretope && (
        <div className="modal-overlay">
          <div className="modal-contenido modal-sm">
            <div className="modal-header" style={{ borderBottomColor: "#d97706" }}>
              <h3>⚠️ Autorizar Sobretope #{modalAprobarSobretope.id}</h3>
              <button className="btn-cerrar-modal" onClick={() => setModalAprobarSobretope(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>
                ¿Confirmas la autorización del <strong>sobretope</strong> para el anticipo <strong>#{modalAprobarSobretope.id}</strong> solicitado por <strong>{modalAprobarSobretope.nombre}</strong>?
              </p>
              <div style={{ background: "var(--bg-tertiary)", padding: "0.8rem", borderRadius: "8px", margin: "1rem 0", fontSize: "0.9rem" }}>
                <div><strong>Monto solicitado:</strong> {formatoMoneda.format(modalAprobarSobretope.valor)}</div>
                <div><strong>Límite estándar:</strong> {formatoMoneda.format(modalAprobarSobretope.monto_tope_aplicado || 1500000)}</div>
                <div style={{ marginTop: "0.3rem", color: "#d97706", fontWeight: 600 }}>
                  Excedente: {formatoMoneda.format(modalAprobarSobretope.valor - (modalAprobarSobretope.monto_tope_aplicado || 1500000))}
                </div>
              </div>
              <div className="alerta-info-modal">
                ℹ️ Al autorizar este sobretope, el anticipo pasará a estado <strong>Pendiente</strong> e iniciará el ciclo formal de aprobación secuencial (Paso 1).
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancelar-modal" onClick={() => setModalAprobarSobretope(null)}>
                Cancelar
              </button>
              <button
                className="btn-confirmar-aprobar"
                style={{ background: "#d97706", borderColor: "#b45309" }}
                onClick={handleAprobarSobretope}
                disabled={procesandoAccion}
              >
                {procesandoAccion ? "Autorizando..." : "Confirmar Autorización de Sobretope"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RECHAZAR SOBRETOPE */}
      {modalRechazarSobretope && (
        <div className="modal-overlay">
          <div className="modal-contenido modal-sm">
            <div className="modal-header header-rechazo">
              <h3>❌ Rechazar Sobretope #{modalRechazarSobretope.id}</h3>
              <button className="btn-cerrar-modal" onClick={() => setModalRechazarSobretope(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>
                Indica el motivo por el cual <strong>no se autoriza el sobretope</strong> de <strong>{formatoMoneda.format(modalRechazarSobretope.valor)}</strong> a <strong>{modalRechazarSobretope.nombre}</strong>.
              </p>
              <div className="campo-form-modal">
                <label>Motivo de no autorización (Obligatorio):</label>
                <textarea
                  rows="3"
                  value={motivoRechazoSobretope}
                  onChange={(e) => setMotivoRechazoSobretope(e.target.value)}
                  placeholder="Explica el motivo por el que no se concede el monto superior al tope..."
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancelar-modal" onClick={() => setModalRechazarSobretope(null)}>
                Cancelar
              </button>
              <button
                className="btn-confirmar-rechazar"
                onClick={handleRechazarSobretope}
                disabled={procesandoAccion || !motivoRechazoSobretope.trim()}
              >
                {procesandoAccion ? "Rechazando..." : "Confirmar Rechazo de Sobretope"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
