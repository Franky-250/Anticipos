import { NavLink } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

const ICONOS = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  solicitudes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  estados: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  aprobaciones: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  colaboradores: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  recaudo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <path d="M6 15h2" />
      <path d="M10 15h4" />
    </svg>
  ),
};

const OPCIONES = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/solicitudes", label: "Nueva Solicitud", icon: "solicitudes" },
  { to: "/estados", label: "Consulta de Solicitudes", icon: "estados" },
  { to: "/aprobaciones", label: "Aprobaciones", icon: "aprobaciones" },
  { to: "/colaboradores", label: "Colaboradores y Flujos", icon: "colaboradores" },
  { to: "/recaudo", label: "Recaudo", icon: "recaudo" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <nav className="sidebar">
      <div className="sidebar-top-section">
        {/* Marca / Logo */}
        <div className="sidebar-marca">
          <div className="sidebar-logo-glow">
            <span className="sidebar-logo-txt">AO</span>
          </div>
          <div className="sidebar-marca-texto">
            <span className="sidebar-titulo">Anticipos</span>
            <span className="sidebar-subtitulo">Ecosistema Pandora</span>
          </div>
        </div>

        {/* Menú de Navegación */}
        <div className="sidebar-nav-container">
          <span className="sidebar-seccion-label">MENÚ PRINCIPAL</span>
          <ul className="sidebar-menu-list">
            {OPCIONES.map((opcion) => (
              <li key={opcion.to}>
                <NavLink
                  to={opcion.to}
                  end={opcion.end}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? "activo" : ""}`
                  }
                >
                  <span className="icono">{ICONOS[opcion.icon]}</span>
                  <span className="sidebar-link-label">{opcion.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Pie del Sidebar: Usuario Logueado */}
      <div className="sidebar-bottom-section">
        {user ? (
          <div className="sidebar-profile-card">
            <div className="sidebar-profile-avatar">
              {user.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="sidebar-profile-info">
              <span className="sidebar-profile-name" title={user.name}>
                {user.name}
              </span>
              <span
                className="sidebar-profile-cargo"
                title={user.cargo || user.email}
              >
                {user.cargo || user.email || "Usuario Corporativo"}
              </span>
            </div>
            <button
              className="btn-sidebar-quick-logout"
              onClick={logout}
              title="Cerrar sesión"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="sidebar-sin-sesion-tag">
            <span>🔒 Sesión no activa</span>
          </div>
        )}
      </div>
    </nav>
  );
}
