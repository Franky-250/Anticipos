import { useEffect, useState } from "react";
import { eliminarAnticipo, listarAnticipos } from "./api";

const formatoMoneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const ETIQUETAS_ESTADO = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

export default function ListaAnticipos({ reloadKey }) {
  const [anticipos, setAnticipos] = useState([]);
  const [error, setError] = useState(null);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [notificacion, setNotificacion] = useState(null);

  const cargarAnticipos = () => {
    listarAnticipos()
      .then(setAnticipos)
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    cargarAnticipos();
  }, [reloadKey]);

  const handleEliminar = async (anticipo) => {
    const confirmar = window.confirm(
      `¿Estás seguro de que deseas eliminar la solicitud #${anticipo.id} de ${anticipo.nombre} por ${formatoMoneda.format(anticipo.valor)}? Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    setEliminandoId(anticipo.id);
    try {
      await eliminarAnticipo(anticipo.id);
      setAnticipos((prev) => prev.filter((a) => a.id !== anticipo.id));
      setNotificacion(`Solicitud #${anticipo.id} eliminada exitosamente.`);
      setTimeout(() => setNotificacion(null), 4000);
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
    } finally {
      setEliminandoId(null);
    }
  };

  if (error) return <p className="mensaje mensaje-error">{error}</p>;

  return (
    <div className="lista-anticipos">
      {notificacion && (
        <div className="mensaje mensaje-exito" style={{ marginBottom: "1rem" }}>
          ✅ {notificacion}
        </div>
      )}

      {anticipos.length === 0 ? (
        <div className="estado-vacio">
          <p>No hay solicitudes registradas.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Solicitante</th>
              <th>Obra / CC</th>
              <th>Motivo</th>
              <th>Valor</th>
              <th>Quién Autoriza</th>
              <th>Firma</th>
              <th>Estado</th>
              <th style={{ textAlign: "center" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {anticipos.map((a) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 700, color: "var(--texto-suave)", fontSize: "0.85rem" }}>
                  #{a.id}
                </td>
                <td>
                  <strong>{a.nombre}</strong>
                  <div style={{ fontSize: "0.78rem", color: "var(--texto-suave)" }}>
                    CC: {a.cedula} {a.cargo ? `· ${a.cargo}` : ""} {a.empresa ? `· ${a.empresa}` : ""}
                  </div>
                </td>
                <td>
                  <div>{a.obra}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--texto-suave)" }}>
                    CC: {a.centro_costo}
                  </div>
                </td>
                <td>
                  <div style={{ maxWidth: "240px", fontSize: "0.88rem" }}>
                    <span style={{ fontWeight: 600, color: a.motivo_tipo === "compras" ? "#2563eb" : "#059669" }}>
                      {a.motivo_tipo === "compras" ? "🛍️ Compras" : "🚚 Transporte"}
                    </span>
                    <div style={{ fontSize: "0.8rem", color: "var(--texto-suave)", marginTop: "0.15rem" }}>
                      {a.motivo_tipo === "compras"
                        ? a.motivo_detalle || a.justificacion
                        : a.transporte_otro
                        ? a.motivo_detalle || a.justificacion
                        : `Destino: ${a.obra_destino || a.justificacion}`}
                    </div>
                  </div>
                </td>
                <td>
                  <strong>{formatoMoneda.format(a.valor)}</strong>
                </td>
                <td>{a.director_autoriza}</td>
                <td>
                  {a.firma ? (
                    <img
                      src={a.firma}
                      alt="Firma"
                      style={{ height: "30px", maxWidth: "70px", objectFit: "contain", border: "1px solid #e2e8f0", borderRadius: "4px", padding: "2px", background: "#fff" }}
                    />
                  ) : (
                    <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Sin firma</span>
                  )}
                </td>
                <td>
                  <span className={`estado estado-${a.estado}`}>
                    {ETIQUETAS_ESTADO[a.estado] || a.estado}
                  </span>
                </td>
                <td style={{ textAlign: "center" }}>
                  <button
                    className="btn-eliminar-anticipo"
                    onClick={() => handleEliminar(a)}
                    disabled={eliminandoId === a.id}
                    title="Eliminar solicitud"
                  >
                    {eliminandoId === a.id ? (
                      <span className="spinner-micro"></span>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
