import { useEffect, useState, useMemo } from "react";
import { listarAnticipos, legalizarAnticipo } from "../api";
import { useAuth } from "../context/AuthContext";

const formatoMoneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function Recaudo() {
  const { user } = useAuth();
  const [anticipos, setAnticipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtroLegalizado, setFiltroLegalizado] = useState("pendientes"); // pendientes, legalizados, todos
  const [busqueda, setBusqueda] = useState("");
  const [notificacion, setNotificacion] = useState(null);

  // Modal de Detalle y Legalización
  const [modalDetalle, setModalDetalle] = useState(null);
  const [checkLegalizado, setCheckLegalizado] = useState(false);
  const [montoLegalizadoInput, setMontoLegalizadoInput] = useState("");
  const [observacionesInput, setObservacionesInput] = useState("");
  const [guardandoLegalizacion, setGuardandoLegalizacion] = useState(false);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const data = await listarAnticipos();
      setAnticipos(data);
      setError(null);
    } catch (err) {
      console.error("Error al cargar anticipos:", err);
      setError("No se pudieron cargar las solicitudes de recaudo.");
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

  // Abrir modal configurando los valores actuales de la solicitud
  const abrirModalDetalle = (anticipo) => {
    setModalDetalle(anticipo);
    setCheckLegalizado(Boolean(anticipo.legalizado));
    setMontoLegalizadoInput(
      anticipo.monto_legalizado !== null && anticipo.monto_legalizado !== undefined && Number(anticipo.monto_legalizado) > 0
        ? String(anticipo.monto_legalizado)
        : String(anticipo.valor)
    );
    setObservacionesInput(anticipo.observaciones_legalizacion || "");
  };

  // Guardar estado de Legalización
  const handleGuardarLegalizacion = async () => {
    if (!modalDetalle) return;

    try {
      setGuardandoLegalizacion(true);
      const montoNum = checkLegalizado ? Number(montoLegalizadoInput) || Number(modalDetalle.valor) : 0;

      const payload = {
        legalizado: checkLegalizado,
        monto_legalizado: montoNum,
        legalizado_por: user?.name || "Responsable de Recaudo",
        observaciones: observacionesInput.trim(),
      };

      const actualizado = await legalizarAnticipo(modalDetalle.id, payload);

      setAnticipos((prev) =>
        prev.map((a) => (a.id === actualizado.id ? actualizado : a))
      );
      setModalDetalle(actualizado);

      mostrarNotif(
        "exito",
        checkLegalizado
          ? `¡Anticipo #${modalDetalle.id} marcado como Legalizado (${formatoMoneda.format(montoNum)})!`
          : `Anticipo #${modalDetalle.id} actualizado como Pendiente de Legalización.`
      );
    } catch (err) {
      console.error("Error al guardar legalización:", err);
      mostrarNotif("error", err.message || "Error al actualizar la legalización.");
    } finally {
      setGuardandoLegalizacion(false);
    }
  };

  // Cálculos para KPIs
  const totalSolicitudes = anticipos.length;
  const valorTotalBruto = useMemo(
    () => anticipos.reduce((acc, a) => acc + Number(a.valor), 0),
    [anticipos]
  );
  const valorLegalizadoTotal = useMemo(
    () =>
      anticipos
        .filter((a) => a.legalizado)
        .reduce(
          (acc, a) =>
            acc +
            Number(
              a.monto_legalizado !== null && a.monto_legalizado !== undefined
                ? a.monto_legalizado
                : a.valor
            ),
          0
        ),
    [anticipos]
  );
  const saldoPendienteLegalizar = Math.max(0, valorTotalBruto - valorLegalizadoTotal);

  const conteoPendientes = useMemo(
    () => anticipos.filter((a) => !a.legalizado).length,
    [anticipos]
  );
  const conteoLegalizados = useMemo(
    () => anticipos.filter((a) => a.legalizado).length,
    [anticipos]
  );

  // Filtrado de solicitudes
  const anticiposFiltrados = useMemo(() => {
    let lista = anticipos;

    if (filtroLegalizado === "pendientes") {
      lista = lista.filter((a) => !a.legalizado);
    } else if (filtroLegalizado === "legalizados") {
      lista = lista.filter((a) => a.legalizado);
    }

    const q = busqueda.toLowerCase().trim();
    if (q) {
      lista = lista.filter(
        (a) =>
          String(a.id).includes(q) ||
          a.nombre.toLowerCase().includes(q) ||
          a.cedula.toLowerCase().includes(q) ||
          a.obra.toLowerCase().includes(q) ||
          a.centro_costo.toLowerCase().includes(q) ||
          (a.flujo_nombre && a.flujo_nombre.toLowerCase().includes(q))
      );
    }

    return lista;
  }, [anticipos, filtroLegalizado, busqueda]);

  return (
    <div className="recaudo-page">
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
          <h2>Gestión de Recaudo y Legalización</h2>
          <p>
            Control contable de desembolsos, registro de soportes y legalización de anticipos de obra.
          </p>
        </div>
      </div>

      {/* KPIs de Recaudo */}
      <div className="colaboradores-kpis">
        <div
          className={`kpi-card ${filtroLegalizado === "pendientes" ? "kpi-seleccionado" : ""}`}
          onClick={() => setFiltroLegalizado("pendientes")}
          style={{ cursor: "pointer" }}
        >
          <div className="kpi-icono">⏳</div>
          <div className="kpi-info">
            <span className="kpi-valor">{formatoMoneda.format(saldoPendienteLegalizar)}</span>
            <span className="kpi-label">Saldo Pendiente por Legalizar ({conteoPendientes})</span>
          </div>
        </div>

        <div
          className={`kpi-card ${filtroLegalizado === "legalizados" ? "kpi-seleccionado" : ""}`}
          onClick={() => setFiltroLegalizado("legalizados")}
          style={{ cursor: "pointer" }}
        >
          <div className="kpi-icono">💵</div>
          <div className="kpi-info">
            <span className="kpi-valor" style={{ color: "#16a34a" }}>
              {formatoMoneda.format(valorLegalizadoTotal)}
            </span>
            <span className="kpi-label">Monto Legalizado ({conteoLegalizados})</span>
          </div>
        </div>

        <div
          className={`kpi-card ${filtroLegalizado === "todos" ? "kpi-seleccionado" : ""}`}
          onClick={() => setFiltroLegalizado("todos")}
          style={{ cursor: "pointer" }}
        >
          <div className="kpi-icono">📊</div>
          <div className="kpi-info">
            <span className="kpi-valor">{formatoMoneda.format(valorTotalBruto)}</span>
            <span className="kpi-label">Monto Total Solicitado ({totalSolicitudes})</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="colab-busqueda-bar" style={{ marginTop: "1.5rem" }}>
        <div className="input-busqueda-icono">
          <span>🔍</span>
          <input
            type="text"
            placeholder="Buscar por ID, solicitante, cédula, centro de costo u obra..."
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
            className={`btn-filtro-tag ${filtroLegalizado === "pendientes" ? "activo" : ""}`}
            onClick={() => setFiltroLegalizado("pendientes")}
          >
            ⏳ Pendientes ({conteoPendientes})
          </button>
          <button
            className={`btn-filtro-tag ${filtroLegalizado === "legalizados" ? "activo" : ""}`}
            onClick={() => setFiltroLegalizado("legalizados")}
          >
            ✅ Legalizados ({conteoLegalizados})
          </button>
          <button
            className={`btn-filtro-tag ${filtroLegalizado === "todos" ? "activo" : ""}`}
            onClick={() => setFiltroLegalizado("todos")}
          >
            📋 Todos ({totalSolicitudes})
          </button>
        </div>
      </div>

      {/* Tabla Principal de Recaudo */}
      {cargando ? (
        <div className="colaboradores-cargando">
          <div className="spinner"></div>
          <p>Cargando módulo de recaudo y legalizaciones...</p>
        </div>
      ) : error ? (
        <p className="mensaje mensaje-error">{error}</p>
      ) : anticiposFiltrados.length === 0 ? (
        <div className="flujo-timeline-vacio" style={{ marginTop: "1.5rem" }}>
          <p>No se encontraron solicitudes con los filtros aplicados.</p>
        </div>
      ) : (
        <div className="lista-anticipos" style={{ marginTop: "1rem" }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Solicitante</th>
                <th>Obra / Centro</th>
                <th>Monto Solicitado</th>
                <th>Monto Legalizado</th>
                <th>Estado Aprobación</th>
                <th>Estado Recaudo</th>
                <th style={{ textAlign: "center" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {anticiposFiltrados.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 800, color: "var(--texto-suave)" }}>
                    #{a.id}
                  </td>
                  <td>
                    <strong>{a.nombre}</strong>
                    <div style={{ fontSize: "0.78rem", color: "var(--texto-suave)" }}>
                      CC: {a.cedula} {a.cargo ? `· ${a.cargo}` : ""}
                    </div>
                  </td>
                  <td>
                    <div>{a.obra}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--texto-suave)" }}>
                      CC: {a.centro_costo}
                    </div>
                  </td>
                  <td>
                    <strong>{formatoMoneda.format(a.valor)}</strong>
                  </td>
                  <td>
                    {a.legalizado ? (
                      <strong style={{ color: "#16a34a" }}>
                        {formatoMoneda.format(a.monto_legalizado || a.valor)}
                      </strong>
                    ) : (
                      <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>$0 (Pendiente)</span>
                    )}
                  </td>
                  <td>
                    <span className={`estado estado-${a.estado}`}>
                      {a.estado === "pendiente"
                        ? `⏳ Nivel ${a.paso_actual}/${a.total_pasos}`
                        : a.estado === "aprobado"
                        ? "✅ Aprobado"
                        : "❌ Rechazado"}
                    </span>
                  </td>
                  <td>
                    {a.legalizado ? (
                      <span
                        className="badge-estado-pill pill-aprobado"
                        style={{ fontSize: "0.78rem", fontWeight: 700 }}
                      >
                        ✅ Legalizado
                      </span>
                    ) : (
                      <span
                        className="badge-estado-pill pill-pendiente"
                        style={{ fontSize: "0.78rem", fontWeight: 700 }}
                      >
                        ⏳ Por Legalizar
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      className="btn-ver-fila-sm"
                      onClick={() => abrirModalDetalle(a)}
                      title="Ver Detalle y Gestionar Recaudo"
                    >
                      🔍 Ver Detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* =======================================================
          MODAL DE DETALLE COMPLETO Y PANEL DE LEGALIZACIÓN
          ======================================================= */}
      {modalDetalle && (
        <div className="modal-overlay">
          <div className="modal-contenido modal-md" style={{ maxWidth: "780px" }}>
            <div className="modal-header">
              <h3>📄 Solicitud #{modalDetalle.id} &middot; Detalle y Cierre de Recaudo</h3>
              <button className="btn-cerrar-modal" onClick={() => setModalDetalle(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Sección 1: Ficha del Anticipo */}
              <div className="detalle-modal-grid">
                <div className="detalle-modal-seccion">
                  <h4>👤 Datos del Solicitante</h4>
                  <div className="fila-detalle-modal">
                    <span>Nombre:</span>
                    <strong>{modalDetalle.nombre}</strong>
                  </div>
                  <div className="fila-detalle-modal">
                    <span>Cédula:</span>
                    <strong>{modalDetalle.cedula}</strong>
                  </div>
                  <div className="fila-detalle-modal">
                    <span>Cargo:</span>
                    <strong>{modalDetalle.cargo || "N/A"}</strong>
                  </div>
                  <div className="fila-detalle-modal">
                    <span>Empresa:</span>
                    <strong>{modalDetalle.empresa || "N/A"}</strong>
                  </div>
                  <div className="fila-detalle-modal">
                    <span>Correo:</span>
                    <strong>{modalDetalle.email_solicitante || "N/A"}</strong>
                  </div>
                </div>

                <div className="detalle-modal-seccion">
                  <h4>🏗️ Datos del Anticipo</h4>
                  <div className="fila-detalle-modal">
                    <span>Obra / Centro:</span>
                    <strong>
                      {modalDetalle.obra} ({modalDetalle.centro_costo})
                    </strong>
                  </div>
                  <div className="fila-detalle-modal">
                    <span>Monto Solicitado:</span>
                    <strong className="monto-resaltado">
                      {formatoMoneda.format(modalDetalle.valor)}
                    </strong>
                  </div>
                  <div className="fila-detalle-modal">
                    <span>Motivo:</span>
                    <strong>
                      {modalDetalle.motivo_tipo === "compras" ? "🛍️ Compras" : "🚚 Transporte"}
                    </strong>
                  </div>
                  <div className="fila-detalle-modal">
                    <span>Detalle / Destino:</span>
                    <strong>
                      {modalDetalle.motivo_detalle || modalDetalle.obra_destino || "N/A"}
                    </strong>
                  </div>
                  {modalDetalle.justificacion && (
                    <div className="fila-detalle-modal">
                      <span>Justificación:</span>
                      <strong>{modalDetalle.justificacion}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Firma si existe */}
              {modalDetalle.firma && (
                <div className="detalle-firma-box">
                  <h4>✍️ Firma del Solicitante</h4>
                  <img
                    src={modalDetalle.firma}
                    alt="Firma del solicitante"
                    className="img-firma-modal"
                  />
                </div>
              )}

              {/* ==========================================
                  SECCIÓN 2: CONTROL Y REGISTRO DE LEGALIZACIÓN
                  ========================================== */}
              <div
                className="panel-legalizacion-box"
                style={{
                  background: checkLegalizado ? "#f0fdf4" : "#f8fafc",
                  border: `2px solid ${checkLegalizado ? "#86efac" : "#e2e8f0"}`,
                  borderRadius: "12px",
                  padding: "1.25rem",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ fontSize: "1.4rem" }}>💵</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>
                        Registro y Legalización de Recaudo
                      </h4>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>
                        Marca esta solicitud como legalizada para descontar del monto pendiente y sumarlo al monto legalizado en el Dashboard.
                      </p>
                    </div>
                  </div>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      cursor: "pointer",
                      background: checkLegalizado ? "#16a34a" : "#cbd5e1",
                      color: "#ffffff",
                      padding: "0.5rem 0.9rem",
                      borderRadius: "8px",
                      fontWeight: 700,
                      fontSize: "0.88rem",
                      userSelect: "none",
                      transition: "background 0.2s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checkLegalizado}
                      onChange={(e) => setCheckLegalizado(e.target.checked)}
                      style={{ width: "16px", height: "16px", cursor: "pointer" }}
                    />
                    <span>{checkLegalizado ? "✅ Legalizado" : "Marcar como Legalizado"}</span>
                  </label>
                </div>

                {checkLegalizado && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.85rem" }}>
                    <div className="campo-form-modal">
                      <label>Monto Legalizado (COP):</label>
                      <input
                        type="number"
                        step="1000"
                        value={montoLegalizadoInput}
                        onChange={(e) => setMontoLegalizadoInput(e.target.value)}
                        placeholder="Monto legalizado..."
                        style={{
                          padding: "0.65rem 0.85rem",
                          border: "1.5px solid #86efac",
                          borderRadius: "8px",
                          fontWeight: 700,
                          fontSize: "1rem",
                          color: "#15803d",
                        }}
                      />
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        Valor original: {formatoMoneda.format(modalDetalle.valor)}
                      </span>
                    </div>

                    <div className="campo-form-modal">
                      <label>Legalizado por:</label>
                      <input
                        type="text"
                        disabled
                        value={user?.name || modalDetalle.legalizado_por || "Responsable de Recaudo"}
                        style={{
                          padding: "0.65rem 0.85rem",
                          background: "#f1f5f9",
                          border: "1px solid #cbd5e1",
                          borderRadius: "8px",
                          color: "#475569",
                        }}
                      />
                      {modalDetalle.fecha_legalizacion && (
                        <span style={{ fontSize: "0.75rem", color: "#16a34a" }}>
                          Fecha: {new Date(modalDetalle.fecha_legalizacion).toLocaleString("es-CO")}
                        </span>
                      )}
                    </div>

                    <div className="campo-form-modal" style={{ gridColumn: "1 / -1" }}>
                      <label>Observaciones / Comprobantes de Recaudo:</label>
                      <textarea
                        rows="2"
                        value={observacionesInput}
                        onChange={(e) => setObservacionesInput(e.target.value)}
                        placeholder="Ingresa número de comprobante, soportes contables o notas de legalización..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Historial de pasos de aprobación */}
              <div className="detalle-pasos-completo">
                <h4>⛓️ Trazabilidad de Aprobaciones Recibidas</h4>
                <div className="tabla-pasos-modal">
                  {modalDetalle.progreso_pasos?.map((p) => (
                    <div
                      key={p.id || p.orden}
                      className={`fila-paso-historial estado-paso-${p.estado}`}
                    >
                      <span className="paso-num-col">Paso {p.orden}</span>
                      <div className="paso-info-col">
                        <strong>{p.nombre_aprobador}</strong>
                        <span>{p.rol_nivel || "Aprobador"}</span>
                        {p.comentario && (
                          <p className="paso-comentario-txt">"{p.comentario}"</p>
                        )}
                      </div>
                      <span className={`badge-estado-sm estado-${p.estado}`}>
                        {p.estado === "aprobado"
                          ? "✓ Aprobado"
                          : p.estado === "rechazado"
                          ? "✕ Rechazado"
                          : p.estado === "pendiente"
                          ? "⏳ Pendiente"
                          : "En espera"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-cancelar-modal"
                onClick={() => setModalDetalle(null)}
              >
                Cerrar
              </button>
              <button
                className="btn-confirmar-aprobar"
                onClick={handleGuardarLegalizacion}
                disabled={guardandoLegalizacion}
                style={{
                  background: checkLegalizado ? "#16a34a" : "#4f46e5",
                }}
              >
                {guardandoLegalizacion
                  ? "Guardando..."
                  : checkLegalizado
                  ? "💾 Guardar Legalización"
                  : "💾 Actualizar Estado"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
