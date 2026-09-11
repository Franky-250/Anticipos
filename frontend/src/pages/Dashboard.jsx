import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { eliminarAnticipo, listarAnticipos } from "../api";
import { useAuth } from "../context/AuthContext";

const formatoMoneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function Dashboard() {
  const { user } = useAuth();
  const [anticipos, setAnticipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [eliminandoId, setEliminandoId] = useState(null);

  const cargarDatos = () => {
    listarAnticipos()
      .then((data) => {
        setAnticipos(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleEliminar = async (anticipo) => {
    const confirmar = window.confirm(
      `¿Deseas eliminar la solicitud #${anticipo.id} de ${anticipo.nombre} por ${formatoMoneda.format(anticipo.valor)}?`
    );
    if (!confirmar) return;

    setEliminandoId(anticipo.id);
    try {
      await eliminarAnticipo(anticipo.id);
      setAnticipos((prev) => prev.filter((a) => a.id !== anticipo.id));
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
    } finally {
      setEliminandoId(null);
    }
  };

  if (error) return <p className="mensaje mensaje-error">{error}</p>;

  const total = anticipos.length;
  const pendientes = anticipos.filter((a) => a.estado === "pendiente").length;
  const aprobados = anticipos.filter((a) => a.estado === "aprobado").length;
  const rechazados = anticipos.filter((a) => a.estado === "rechazado").length;
  
  const valorTotalBruto = anticipos.reduce((acc, a) => acc + Number(a.valor), 0);
  const valorLegalizado = anticipos
    .filter((a) => a.legalizado)
    .reduce((acc, a) => acc + Number(a.monto_legalizado !== null && a.monto_legalizado !== undefined ? a.monto_legalizado : a.valor), 0);
  const valorSolicitadoPendiente = Math.max(0, valorTotalBruto - valorLegalizado);

  const tarjetas = [
    {
      titulo: "Total Solicitudes",
      valor: total,
      icono: "📋",
      tono: "azul",
      subtexto: "Radicadas en el sistema",
    },
    {
      titulo: "Pendientes",
      valor: pendientes,
      icono: "⏳",
      tono: "amarillo",
      subtexto: "En flujo de aprobación",
    },
    {
      titulo: "Aprobados",
      valor: aprobados,
      icono: "✅",
      tono: "verde",
      subtexto: "Listos para desembolso",
    },
    {
      titulo: "Rechazados",
      valor: rechazados,
      icono: "❌",
      tono: "rojo",
      subtexto: "No autorizados",
    },
    {
      titulo: "Monto Solicitado (Pendiente)",
      valor: formatoMoneda.format(valorSolicitadoPendiente),
      icono: "⏳",
      tono: "morado",
      subtexto: "Saldo pendiente por legalizar",
      ancho: false,
    },
    {
      titulo: "Monto Legalizado",
      valor: formatoMoneda.format(valorLegalizado),
      icono: "💵",
      tono: "verde",
      subtexto: "Cerrado y justificado en recaudo",
      ancho: false,
    },
  ];

  // Últimas 5 solicitudes
  const ultimasSolicitudes = anticipos.slice(0, 5);

  return (
    <div className="dashboard-container">
      {/* Saludo y Encabezado */}
      <div className="dashboard-hero-banner">
        <div className="hero-textos">
          <h2>Hola, {user?.name ? user.name.split(" ")[0] : "Colaborador"} 👋</h2>
          <p>
            Bienvenido al portal de control y gestión de anticipos de obra. Aquí tienes el resumen en tiempo real:
          </p>
        </div>
        <div className="hero-acciones">
          <Link to="/solicitudes" className="btn-hero-primario">
            <span>+</span> Nueva Solicitud
          </Link>
          <Link to="/aprobaciones" className="btn-hero-secundario">
            <span>⚡</span> Bandeja de Aprobaciones
          </Link>
        </div>
      </div>

      {/* Tarjetas KPIs Modernas */}
      <div className="dashboard-kpis-grid">
        {tarjetas.map((t) => (
          <div
            className={`kpi-stat-card kpi-stat-${t.tono} ${t.ancho ? "kpi-stat-wide" : ""}`}
            key={t.titulo}
          >
            <div className="kpi-stat-top">
              <span className="kpi-stat-titulo">{t.titulo}</span>
              <div className="kpi-stat-icon-wrap">{t.icono}</div>
            </div>
            <div className="kpi-stat-valor">{t.valor}</div>
            <div className="kpi-stat-sub">{t.subtexto}</div>
          </div>
        ))}
      </div>

      {/* Sección Inferior: Solicitudes Recientes y Accesos Rápidos */}
      <div className="dashboard-grid-secciones">
        {/* Tabla / Lista de Solicitudes Recientes */}
        <div className="dashboard-card-panel">
          <div className="panel-header">
            <div className="panel-header-titulo">
              <span className="panel-icono">🕒</span>
              <div>
                <h3>Solicitudes Recientes</h3>
                <p>Últimos anticipos radicados en el sistema</p>
              </div>
            </div>
            <Link to="/estados" className="panel-link-ver-todo">
              Ver todas →
            </Link>
          </div>

          {cargando ? (
            <div className="colaboradores-cargando" style={{ padding: "2rem" }}>
              <div className="spinner"></div>
              <p>Cargando datos del dashboard...</p>
            </div>
          ) : ultimasSolicitudes.length === 0 ? (
            <div className="panel-vacio-txt">
              <p>Aún no hay solicitudes registradas.</p>
              <Link to="/solicitudes" className="btn-hero-primario" style={{ display: "inline-flex" }}>
                + Crear la primera solicitud
              </Link>
            </div>
          ) : (
            <div className="tabla-recientes-wrap">
              <table className="tabla-recientes">
                <thead>
                  <tr>
                    <th>Solicitante</th>
                    <th>Obra / CC</th>
                    <th>Monto</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimasSolicitudes.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong className="reciente-solicitante">{a.nombre}</strong>
                        <span className="reciente-cargo">{a.cargo || "Sin cargo"}</span>
                      </td>
                      <td>
                        <span className="reciente-obra">🏗️ {a.obra}</span>
                        <span className="reciente-cc">CC: {a.centro_costo}</span>
                      </td>
                      <td>
                        <strong className="reciente-monto">
                          {formatoMoneda.format(a.valor)}
                        </strong>
                      </td>
                      <td>
                        <span className={`badge-estado-pill pill-${a.estado}`}>
                          {a.estado === "pendiente"
                            ? `⏳ Nivel ${a.paso_actual || 1}/${a.total_pasos || 1}`
                            : a.estado === "aprobado"
                            ? "✅ Aprobado"
                            : "❌ Rechazado"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <Link
                            to="/aprobaciones"
                            className="btn-ver-fila-sm"
                            title="Ver en Aprobaciones"
                          >
                            Ver
                          </Link>
                          <button
                            className="btn-eliminar-anticipo"
                            onClick={() => handleEliminar(a)}
                            disabled={eliminandoId === a.id}
                            title="Eliminar solicitud"
                          >
                            {eliminandoId === a.id ? (
                              <span className="spinner-micro"></span>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Accesos Rápidos y Ecosistema Pandora */}
        <div className="dashboard-shortcuts-panel">
          <div className="panel-header">
            <div className="panel-header-titulo">
              <span className="panel-icono">🚀</span>
              <div>
                <h3>Módulos del Sistema</h3>
                <p>Navegación directa</p>
              </div>
            </div>
          </div>

          <div className="shortcuts-list">
            <Link to="/solicitudes" className="shortcut-item">
              <div className="shortcut-icono bg-azul">📝</div>
              <div className="shortcut-info">
                <strong>Nueva Solicitud</strong>
                <span>Radica anticipos de compras o transporte</span>
              </div>
              <span className="shortcut-arrow">→</span>
            </Link>

            <Link to="/aprobaciones" className="shortcut-item">
              <div className="shortcut-icono bg-morado">⚡</div>
              <div className="shortcut-info">
                <strong>Bandeja de Aprobaciones</strong>
                <span>Revisa, autoriza o rechaza solicitudes</span>
              </div>
              <span className="shortcut-arrow">→</span>
            </Link>

            <Link to="/colaboradores" className="shortcut-item">
              <div className="shortcut-icono bg-verde">👥</div>
              <div className="shortcut-info">
                <strong>Colaboradores y Flujos</strong>
                <span>Maestra de personal y constructor de pasos</span>
              </div>
              <span className="shortcut-arrow">→</span>
            </Link>

            <Link to="/estados" className="shortcut-item">
              <div className="shortcut-icono bg-amarillo">🔍</div>
              <div className="shortcut-info">
                <strong>Consulta General</strong>
                <span>Historial y trazabilidad de solicitudes</span>
              </div>
              <span className="shortcut-arrow">→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
