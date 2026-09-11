import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function NotFound404() {
  const { loginManual } = useAuth();
  const [modalManual, setModalManual] = useState(false);
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");

  const handleManualLogin = (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    loginManual({
      id: 1,
      name: nombre.trim(),
      cargo: cargo.trim() || "Colaborador",
      email: email.trim() || `${nombre.toLowerCase().replace(/\s+/g, ".")}@pcmejia.com.co`,
      role: "admin",
    });

    setModalManual(false);
  };

  const reintentarSSO = () => {
    if (window.opener) {
      window.opener.postMessage("CERBERUS_REQUEST_SSO_TOKEN", "https://pandora.pcmejia.com");
    } else {
      window.open("https://pandora.pcmejia.com", "_blank");
    }
  };

  return (
    <div className="pagina-404-container">
      <div className="card-404">
        <div className="codigo-404">404</div>
        <div className="icono-404">🔒</div>
        <h2>Página No Encontrada</h2>
        <p className="desc-404">
          La página solicitada no existe, no está disponible o no se encuentra una sesión activa autenticada con <strong>Pandora / Cerberus SSO</strong>.
        </p>

        <div className="acciones-404">
          <button className="btn-404-pandora" onClick={reintentarSSO}>
            🔐 Autenticar con Pandora SSO
          </button>
          
          <button className="btn-404-secundario" onClick={() => setModalManual(true)}>
            Acceso con Credenciales
          </button>
        </div>

        <div className="footer-404-marca">
          <span>Ecosistema Corporativo PCM Mejía &middot; Pandora SSO</span>
        </div>
      </div>

      {/* Modal para acceso de desarrollo o manual */}
      {modalManual && (
        <div className="modal-overlay">
          <div className="modal-contenido modal-sm">
            <div className="modal-header">
              <h3>🔐 Iniciar Sesión</h3>
              <button className="btn-cerrar-modal" onClick={() => setModalManual(false)}>✕</button>
            </div>
            <form onSubmit={handleManualLogin}>
              <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>
                Ingresa los datos para acceder al sistema:
              </p>

              <div className="campo">
                <label>Nombre y Apellidos:</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="ej. Yeison Mena"
                  required
                />
              </div>

              <div className="campo">
                <label>Cargo:</label>
                <input
                  type="text"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="ej. Director de Proyectos / Residente de Obra"
                />
              </div>

              <div className="campo">
                <label>Correo Electrónico:</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ej. usuario@pcmejia.com.co"
                />
              </div>

              <div className="modal-acciones">
                <button
                  type="button"
                  className="btn-cancelar"
                  onClick={() => setModalManual(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-guardar">
                  Ingresar al Sistema
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
