import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function HeaderBar() {
  const { user, isAuthenticated, logout, loginManual } = useAuth();
  const [modalLoginDemo, setModalLoginDemo] = useState(false);
  const [nombreDemo, setNombreDemo] = useState("");
  const [cargoDemo, setCargoDemo] = useState("");
  const [emailDemo, setEmailDemo] = useState("");

  const handleLoginDemoSubmit = (e) => {
    e.preventDefault();
    if (!nombreDemo.trim()) return;

    loginManual({
      id: 99,
      name: nombreDemo.trim(),
      cargo: cargoDemo.trim() || "Colaborador",
      email: emailDemo.trim() || `${nombreDemo.toLowerCase().replace(/\s+/g, ".")}@pcmejia.com.co`,
      role: "admin",
    });

    setModalLoginDemo(false);
    setNombreDemo("");
    setCargoDemo("");
    setEmailDemo("");
  };

  const esAdmin =
    user?.email?.toLowerCase() === "jheyson.mena@pcmejia.com.co" ||
    user?.rol === "ADMINISTRADOR" ||
    user?.role === "ADMINISTRADOR";

  return (
    <header className="top-header-bar">
      {/* Lado Izquierdo: Estado de Conexión Pandora */}
      <div className="top-header-left">
        <div className="pandora-status-pill">
          <span className="punto-conexion-online"></span>
          <span className="pandora-pill-texto">
            Ecosistema <strong className="pandora-nombre-highlight">Pandora</strong> &middot; SSO Activo
          </span>
        </div>
      </div>

      {/* Lado Derecho: Usuario Logueado & Botón Cerrar Sesión */}
      <div className="top-header-right">
        {isAuthenticated && user ? (
          <div className="header-user-wrapper">
            <div className="header-user-badge">
              <div className="header-user-avatar">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="header-user-info">
                <div className="header-user-name-row">
                  <span className="header-user-name">{user.name}</span>
                  {esAdmin ? (
                    <span className="header-badge-admin">👑 Admin</span>
                  ) : user.rol ? (
                    <span className="header-badge-rol">
                      {user.rol === "APROBADOR" ? "✍️ Aprobador" : user.rol === "RECAUDO" ? "💵 Recaudo" : "📝 Solicitante"}
                    </span>
                  ) : null}
                </div>
                <span className="header-user-cargo" title={user.cargo || user.email}>
                  {user.cargo || user.email || "Usuario Corporativo"}
                </span>
              </div>
            </div>

            <button
              className="btn-header-logout"
              onClick={logout}
              title="Cerrar sesión de forma segura"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Cerrar Sesión</span>
            </button>
          </div>
        ) : (
          <div className="sin-sesion-box">
            <button
              className="btn-conectar-pandora"
              onClick={() => {
                if (window.opener) {
                  window.opener.postMessage("CERBERUS_REQUEST_SSO_TOKEN", "https://pandora.pcmejia.com");
                } else {
                  setModalLoginDemo(true);
                }
              }}
            >
              🔐 Conectar con Pandora SSO
            </button>
          </div>
        )}
      </div>

      {/* Modal para conectar sesión manual o simulación */}
      {modalLoginDemo && (
        <div className="modal-overlay">
          <div className="modal-contenido modal-sm">
            <div className="modal-header">
              <h3>🔐 Iniciar Sesión en Anticipos</h3>
              <button className="btn-cerrar-modal" onClick={() => setModalLoginDemo(false)}>✕</button>
            </div>
            <form onSubmit={handleLoginDemoSubmit}>
              <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>
                Si abres esta app desde el portal de <strong>Pandora</strong>, el inicio de sesión se realiza automáticamente por SSO. También puedes ingresar tus datos manualmente aquí:
              </p>

              <div className="campo">
                <label>Nombre y Apellidos:</label>
                <input
                  type="text"
                  value={nombreDemo}
                  onChange={(e) => setNombreDemo(e.target.value)}
                  placeholder="ej. Yeison Mena"
                  required
                />
              </div>

              <div className="campo">
                <label>Cargo:</label>
                <input
                  type="text"
                  value={cargoDemo}
                  onChange={(e) => setCargoDemo(e.target.value)}
                  placeholder="ej. Director de Proyectos / Residente de Obra"
                />
              </div>

              <div className="campo">
                <label>Correo Corporativo:</label>
                <input
                  type="email"
                  value={emailDemo}
                  onChange={(e) => setEmailDemo(e.target.value)}
                  placeholder="ej. usuario@pcmejia.com.co"
                />
              </div>

              <div className="modal-acciones">
                <button
                  type="button"
                  className="btn-cancelar"
                  onClick={() => setModalLoginDemo(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-guardar">
                  Iniciar Sesión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
