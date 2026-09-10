import { NavLink } from "react-router-dom";

const ICONOS = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  solicitudes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7l4-4Z" />
      <path d="M8 3v4H4" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  ),
  estados: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m9 12 2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
};

const OPCIONES = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/solicitudes", label: "Solicitudes", icon: "solicitudes" },
  { to: "/estados", label: "Estados", icon: "estados" },
];

export default function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar-marca">
        <span className="sidebar-logo">AO</span>
        <span className="sidebar-titulo">Anticipos de Obra</span>
      </div>
      <ul>
        {OPCIONES.map((opcion) => (
          <li key={opcion.to}>
            <NavLink
              to={opcion.to}
              end={opcion.end}
              className={({ isActive }) => (isActive ? "activo" : undefined)}
            >
              <span className="icono">{ICONOS[opcion.icon]}</span>
              {opcion.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
