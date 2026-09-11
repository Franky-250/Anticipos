import { useEffect, useState, useMemo } from "react";
import { listarAnticipos, aprobarPasoAnticipo, rechazarPasoAnticipo } from "../api";
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
  const [comentarioAprobacion, setComentarioAprobacion] = useState("");
  const [motivoRechazo, setMotivoRechazo] = useState("");
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

  // Ejecutar Aprobación de Paso
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

  // Ejecutar Rechazo de Paso
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
            Gestión inteligente de aprobaciones por cargos, secuencia y notificaciones vía Microsoft Graph API.
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
            <span className="kpi-label">Pendientes de Aprobación</span>
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
            const pasoActualObj = a.progreso_pasos?.find((p) => p.orden === a.paso_actual);

            return (
              <div key={a.id} className={`aprobacion-card-item estado-${a.estado}`}>
                <div className="aprobacion-card-header">
                  <div className="aprobacion-id-badge">
                    <span className="id-num">#{a.id}</span>
                    <span className={`badge-estado-pill pill-${a.estado}`}>
                      {a.estado === "pendiente"
                        ? `⏳ En Nivel ${a.paso_actual}/${a.total_pasos}`
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
                        Nivel {a.paso_actual} de {a.total_pasos}
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
    </div>
  );
}
