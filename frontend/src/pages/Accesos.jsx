import { useEffect, useState, useMemo } from "react";
import {
  listarUsuariosRoles,
  listarCatalogoRoles,
  asignarRolUsuario,
  actualizarRolUsuario,
  eliminarRolUsuario,
  obtenerColaboradoresSegmentados,
} from "../api";
import { useAuth } from "../context/AuthContext";
import SearchableSelect from "../components/SearchableSelect";

const ADMIN_PRINCIPAL = "jheyson.mena@pcmejia.com.co";

export default function Accesos() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [catalogoRoles, setCatalogoRoles] = useState([]);
  const [colaboradoresCronos, setColaboradoresCronos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState("TODOS");
  const [notificacion, setNotificacion] = useState(null);

  // Modales
  const [modalAsignar, setModalAsignar] = useState(false);
  const [modalEditar, setModalEditar] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Formulario Asignar
  const [colaboradorSeleccionado, setColaboradorSeleccionado] = useState("");
  const [emailManual, setEmailManual] = useState("");
  const [nombreManual, setNombreManual] = useState("");
  const [cargoManual, setCargoManual] = useState("");
  const [cedulaManual, setCedulaManual] = useState("");
  const [rolSeleccionado, setRolSeleccionado] = useState("APROBADOR");
  const [activoForm, setActivoForm] = useState(true);

  const esAdmin =
    user?.email?.toLowerCase() === ADMIN_PRINCIPAL.toLowerCase() ||
    user?.rol === "ADMINISTRADOR" ||
    user?.role === "ADMINISTRADOR";

  const mostrarNotif = (tipo, mensaje) => {
    setNotificacion({ tipo, mensaje });
    setTimeout(() => setNotificacion(null), 4000);
  };

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError(null);
      const [usersData, rolesData, segData] = await Promise.all([
        listarUsuariosRoles(),
        listarCatalogoRoles().catch(() => []),
        obtenerColaboradoresSegmentados().catch(() => ({ todos: [] })),
      ]);

      setUsuarios(usersData || []);
      setCatalogoRoles(rolesData || []);
      setColaboradoresCronos(segData.todos || []);
    } catch (err) {
      console.error("Error al cargar accesos:", err);
      setError("No se pudieron cargar los datos de roles y accesos.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Opciones formateadas de Cronos para SearchableSelect
  const opcionesColaboradores = useMemo(() => {
    return colaboradoresCronos.map((c) => ({
      codigo: c.cedula || c.nombre,
      nombre: c.nombre,
      cargo: c.cargo || "Sin Cargo",
      email: c.email || c.correo || "",
      cedula: c.cedula || "",
      objetoOriginal: c,
    }));
  }, [colaboradoresCronos]);

  // Manejador al seleccionar un colaborador en el modal
  const handleSeleccionarColaborador = (codigoOValor) => {
    setColaboradorSeleccionado(codigoOValor);
    const encontrado = opcionesColaboradores.find(
      (op) => op.codigo === codigoOValor || op.nombre === codigoOValor
    );
    if (encontrado) {
      setNombreManual(encontrado.nombre);
      setEmailManual(encontrado.email);
      setCargoManual(encontrado.cargo);
      setCedulaManual(encontrado.cedula);
    }
  };

  // Abrir modal de asignación nuevo rol
  const abrirModalNuevo = () => {
    setColaboradorSeleccionado("");
    setEmailManual("");
    setNombreManual("");
    setCargoManual("");
    setCedulaManual("");
    setRolSeleccionado("APROBADOR");
    setActivoForm(true);
    setModalAsignar(true);
  };

  // Guardar nueva asignación de rol
  const handleGuardarAsignacion = async (e) => {
    e.preventDefault();
    if (!emailManual.trim()) {
      mostrarNotif("error", "Por favor ingresa un correo electrónico válido.");
      return;
    }

    try {
      setGuardando(true);
      await asignarRolUsuario({
        email: emailManual.trim().toLowerCase(),
        nombre: nombreManual.trim() || emailManual.trim(),
        cargo: cargoManual.trim(),
        cedula: cedulaManual.trim(),
        rol: rolSeleccionado,
        activo: activoForm,
      });

      mostrarNotif("exito", `¡Rol '${rolSeleccionado}' asignado exitosamente a ${nombreManual || emailManual}!`);
      setModalAsignar(false);
      await cargarDatos();
    } catch (err) {
      console.error("Error al asignar rol:", err);
      mostrarNotif("error", err.message || "Error al asignar rol.");
    } finally {
      setGuardando(false);
    }
  };

  // Guardar edición de usuario
  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    if (!modalEditar) return;

    try {
      setGuardando(true);
      await actualizarRolUsuario(modalEditar.id, {
        rol: modalEditar.rol,
        cargo: modalEditar.cargo,
        activo: modalEditar.activo,
      });

      mostrarNotif("exito", `¡Usuario ${modalEditar.nombre} actualizado correctamente!`);
      setModalEditar(null);
      await cargarDatos();
    } catch (err) {
      console.error("Error al actualizar usuario:", err);
      mostrarNotif("error", err.message || "Error al actualizar usuario.");
    } finally {
      setGuardando(false);
    }
  };

  // Eliminar rol de usuario
  const handleEliminarRol = async (u) => {
    if (u.email.toLowerCase() === ADMIN_PRINCIPAL.toLowerCase()) {
      mostrarNotif("error", "No es posible remover al Administrador Principal del sistema.");
      return;
    }

    if (!window.confirm(`¿Estás seguro de quitar los permisos y rol a ${u.nombre}? Volverá al rol predeterminado de Solicitante.`)) {
      return;
    }

    try {
      await eliminarRolUsuario(u.id);
      mostrarNotif("exito", `Rol eliminado. ${u.nombre} ahora tiene rol de Solicitante.`);
      await cargarDatos();
    } catch (err) {
      console.error("Error al eliminar rol:", err);
      mostrarNotif("error", err.message || "Error al eliminar rol.");
    }
  };

  // Filtrado de usuarios
  const usuariosFiltrados = useMemo(() => {
    let lista = usuarios;

    if (filtroRol !== "TODOS") {
      lista = lista.filter((u) => u.rol === filtroRol);
    }

    const q = busqueda.toLowerCase().trim();
    if (q) {
      lista = lista.filter(
        (u) =>
          (u.nombre && u.nombre.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.cargo && u.cargo.toLowerCase().includes(q)) ||
          (u.cedula && u.cedula.toLowerCase().includes(q))
      );
    }

    return lista;
  }, [usuarios, filtroRol, busqueda]);

  // Contadores para KPIs
  const conteoAdmins = useMemo(
    () => usuarios.filter((u) => u.rol === "ADMINISTRADOR").length,
    [usuarios]
  );
  const conteoAprobadores = useMemo(
    () => usuarios.filter((u) => u.rol === "APROBADOR").length,
    [usuarios]
  );
  const conteoRecaudo = useMemo(
    () => usuarios.filter((u) => u.rol === "RECAUDO").length,
    [usuarios]
  );
  const conteoSolicitantes = useMemo(
    () => usuarios.filter((u) => u.rol === "SOLICITANTE").length,
    [usuarios]
  );

  const obtenerInfoRol = (rolId) => {
    return (
      catalogoRoles.find((r) => r.id === rolId) || {
        nombre: rolId,
        color: "#64748b",
        icono: "👤",
        descripcion: "",
      }
    );
  };

  if (!esAdmin) {
    return (
      <div className="accesos-restringido-page">
        <div className="tarjeta-restringido">
          <span className="icono-restringido">🔒</span>
          <h2>Acceso Restringido a Gestión de Accesos</h2>
          <p>
            Este módulo es de uso exclusivo para los <strong>Administradores del Sistema</strong>.
          </p>
          <div className="info-sesion-actual">
            <span>Usuario autenticado: <strong>{user?.name || user?.email}</strong></span>
            <span>Rol actual: <strong>{user?.rol || "SOLICITANTE"}</strong></span>
          </div>
          <p className="nota-restringido">
            Si necesitas permisos administrativos o de aprobación, por favor contacta al administrador principal en <strong>{ADMIN_PRINCIPAL}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="accesos-page">
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
          <h2>Gestión de Accesos y Roles de Usuario</h2>
          <p>
            Control centralizado de permisos y perfiles para aprobadores, administradores y personal de recaudo.
          </p>
        </div>
        <button className="btn-asignar-nuevo-rol" onClick={abrirModalNuevo}>
          <span>➕</span> Asignar Rol a Colaborador
        </button>
      </div>

      {/* KPIs de Roles */}
      <div className="colaboradores-kpis">
        <div
          className={`kpi-card ${filtroRol === "TODOS" ? "kpi-seleccionado" : ""}`}
          onClick={() => setFiltroRol("TODOS")}
          style={{ cursor: "pointer" }}
        >
          <div className="kpi-icono">👥</div>
          <div className="kpi-info">
            <span className="kpi-valor">{usuarios.length}</span>
            <span className="kpi-label">Usuarios con Rol</span>
          </div>
        </div>

        <div
          className={`kpi-card ${filtroRol === "ADMINISTRADOR" ? "kpi-seleccionado" : ""}`}
          onClick={() => setFiltroRol("ADMINISTRADOR")}
          style={{ cursor: "pointer" }}
        >
          <div className="kpi-icono">🛡️</div>
          <div className="kpi-info">
            <span className="kpi-valor">{conteoAdmins}</span>
            <span className="kpi-label">Administradores</span>
          </div>
        </div>

        <div
          className={`kpi-card ${filtroRol === "APROBADOR" ? "kpi-seleccionado" : ""}`}
          onClick={() => setFiltroRol("APROBADOR")}
          style={{ cursor: "pointer" }}
        >
          <div className="kpi-icono">✍️</div>
          <div className="kpi-info">
            <span className="kpi-valor">{conteoAprobadores}</span>
            <span className="kpi-label">Aprobadores</span>
          </div>
        </div>

        <div
          className={`kpi-card ${filtroRol === "RECAUDO" ? "kpi-seleccionado" : ""}`}
          onClick={() => setFiltroRol("RECAUDO")}
          style={{ cursor: "pointer" }}
        >
          <div className="kpi-icono">💵</div>
          <div className="kpi-info">
            <span className="kpi-valor">{conteoRecaudo}</span>
            <span className="kpi-label">Recaudo / Tesorería</span>
          </div>
        </div>

        <div
          className={`kpi-card ${filtroRol === "SOLICITANTE" ? "kpi-seleccionado" : ""}`}
          onClick={() => setFiltroRol("SOLICITANTE")}
          style={{ cursor: "pointer" }}
        >
          <div className="kpi-icono">📝</div>
          <div className="kpi-info">
            <span className="kpi-valor">{conteoSolicitantes}</span>
            <span className="kpi-label">Solicitantes</span>
          </div>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="colab-busqueda-bar" style={{ marginTop: "1.5rem" }}>
        <div className="input-busqueda-icono">
          <span>🔍</span>
          <input
            type="text"
            placeholder="Buscar por nombre, correo, cargo o cédula..."
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
            className={`btn-filtro-tag ${filtroRol === "TODOS" ? "activo" : ""}`}
            onClick={() => setFiltroRol("TODOS")}
          >
            Todos ({usuarios.length})
          </button>
          <button
            className={`btn-filtro-tag ${filtroRol === "ADMINISTRADOR" ? "activo" : ""}`}
            onClick={() => setFiltroRol("ADMINISTRADOR")}
          >
            🛡️ Administradores ({conteoAdmins})
          </button>
          <button
            className={`btn-filtro-tag ${filtroRol === "APROBADOR" ? "activo" : ""}`}
            onClick={() => setFiltroRol("APROBADOR")}
          >
            ✍️ Aprobadores ({conteoAprobadores})
          </button>
          <button
            className={`btn-filtro-tag ${filtroRol === "RECAUDO" ? "activo" : ""}`}
            onClick={() => setFiltroRol("RECAUDO")}
          >
            💵 Recaudo ({conteoRecaudo})
          </button>
        </div>
      </div>

      {/* Contenido Principal: Tabla de Roles */}
      {cargando ? (
        <div className="colaboradores-cargando">
          <div className="spinner"></div>
          <p>Cargando lista de accesos y roles...</p>
        </div>
      ) : error ? (
        <p className="mensaje mensaje-error">{error}</p>
      ) : usuariosFiltrados.length === 0 ? (
        <div className="flujo-timeline-vacio" style={{ marginTop: "1.5rem" }}>
          <p>No se encontraron usuarios con los criterios de búsqueda aplicados.</p>
        </div>
      ) : (
        <div className="tarjeta-tabla-accesos">
          <table className="tabla-accesos">
            <thead>
              <tr>
                <th>Colaborador / Usuario</th>
                <th>Correo Corporativo</th>
                <th>Cargo / Posición</th>
                <th>Rol Asignado</th>
                <th>Estado</th>
                <th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map((u) => {
                const infoRol = obtenerInfoRol(u.rol);
                const esAdminPpal = u.email.toLowerCase() === ADMIN_PRINCIPAL.toLowerCase();

                return (
                  <tr key={u.id} className={!u.activo ? "fila-inactiva" : ""}>
                    <td>
                      <div className="usuario-celda-info">
                        <div className="usuario-avatar-sm">
                          {u.nombre?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <div className="usuario-datos">
                          <strong>{u.nombre}</strong>
                          {u.cedula && <span className="usuario-cedula">CC: {u.cedula}</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="correo-txt">{u.email}</span>
                      {esAdminPpal && (
                        <span className="badge-admin-ppal">👑 Admin Principal</span>
                      )}
                    </td>
                    <td>
                      <span className="cargo-txt">{u.cargo || "N/A"}</span>
                    </td>
                    <td>
                      <span
                        className="badge-rol-pill"
                        style={{
                          backgroundColor: `${infoRol.color}18`,
                          color: infoRol.color,
                          borderColor: `${infoRol.color}40`,
                        }}
                      >
                        <span>{infoRol.icono}</span>
                        <strong>{infoRol.nombre}</strong>
                      </span>
                    </td>
                    <td>
                      <span className={`badge-estado-activo ${u.activo ? "activo" : "inactivo"}`}>
                        {u.activo ? "● Activo" : "○ Inactivo"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="acciones-usuario-flex">
                        <button
                          className="btn-editar-rol-sm"
                          onClick={() => setModalEditar({ ...u })}
                          title="Cambiar rol o estado"
                        >
                          ✏️ Modificar
                        </button>
                        {!esAdminPpal && (
                          <button
                            className="btn-eliminar-rol-sm"
                            onClick={() => handleEliminarRol(u)}
                            title="Quitar permisos"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL ASIGNAR NUEVO ROL */}
      {modalAsignar && (
        <div className="modal-overlay">
          <div className="modal-contenido modal-md">
            <div className="modal-header">
              <h3>➕ Asignar Rol a Colaborador</h3>
              <button className="btn-cerrar-modal" onClick={() => setModalAsignar(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleGuardarAsignacion}>
              <div className="modal-body">
                <div className="campo-form-modal">
                  <label>Buscar Colaborador en Cronos / Maestra:</label>
                  <SearchableSelect
                    options={opcionesColaboradores}
                    value={colaboradorSeleccionado}
                    onChange={handleSeleccionarColaborador}
                    placeholder="Buscar por nombre, cargo o cédula..."
                    valueKey="codigo"
                    labelKey="nombre"
                  />
                  <span className="ayuda-input-txt">
                    💡 Selecciona una persona de la lista o completa los campos manuales abajo.
                  </span>
                </div>

                <div className="form-grid-2cols">
                  <div className="campo-form-modal">
                    <label>Nombre Completo:</label>
                    <input
                      type="text"
                      value={nombreManual}
                      onChange={(e) => setNombreManual(e.target.value)}
                      placeholder="Ej. Carlos Rodríguez"
                      required
                    />
                  </div>

                  <div className="campo-form-modal">
                    <label>Correo Electrónico Corporativo:</label>
                    <input
                      type="email"
                      value={emailManual}
                      onChange={(e) => setEmailManual(e.target.value)}
                      placeholder="ejemplo@pcmejia.com.co"
                      required
                    />
                  </div>

                  <div className="campo-form-modal">
                    <label>Cargo / Posición:</label>
                    <input
                      type="text"
                      value={cargoManual}
                      onChange={(e) => setCargoManual(e.target.value)}
                      placeholder="Ej. Director de Proyectos"
                    />
                  </div>

                  <div className="campo-form-modal">
                    <label>Cédula de Ciudadanía:</label>
                    <input
                      type="text"
                      value={cedulaManual}
                      onChange={(e) => setCedulaManual(e.target.value)}
                      placeholder="Ej. 1020304050"
                    />
                  </div>
                </div>

                {/* Selección Visual del Rol */}
                <div className="campo-form-modal" style={{ marginTop: "1rem" }}>
                  <label>Seleccionar Rol y Nivel de Acceso:</label>
                  <div className="catalogo-roles-selector">
                    {catalogoRoles.map((r) => (
                      <div
                        key={r.id}
                        className={`tarjeta-rol-opcion ${rolSeleccionado === r.id ? "seleccionado" : ""}`}
                        onClick={() => setRolSeleccionado(r.id)}
                      >
                        <div className="rol-opcion-header">
                          <span className="rol-icono">{r.icono}</span>
                          <strong>{r.nombre}</strong>
                        </div>
                        <p className="rol-desc">{r.descripcion}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="campo-form-modal" style={{ marginTop: "0.5rem" }}>
                  <label className="checkbox-toggle-label">
                    <input
                      type="checkbox"
                      checked={activoForm}
                      onChange={(e) => setActivoForm(e.target.checked)}
                    />
                    <span>Cuenta de acceso activa en el sistema</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancelar-modal"
                  onClick={() => setModalAsignar(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-confirmar-aprobar"
                  disabled={guardando || !emailManual.trim()}
                >
                  {guardando ? "Guardando..." : "Guardar Asignación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR ROL EXISTENTE */}
      {modalEditar && (
        <div className="modal-overlay">
          <div className="modal-contenido modal-md">
            <div className="modal-header">
              <h3>✏️ Modificar Rol de {modalEditar.nombre}</h3>
              <button className="btn-cerrar-modal" onClick={() => setModalEditar(null)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleGuardarEdicion}>
              <div className="modal-body">
                <div className="detalle-usuario-edicion">
                  <div><strong>Correo:</strong> {modalEditar.email}</div>
                  {modalEditar.cedula && <div><strong>Cédula:</strong> {modalEditar.cedula}</div>}
                </div>

                <div className="campo-form-modal" style={{ marginTop: "1rem" }}>
                  <label>Cargo / Posición:</label>
                  <input
                    type="text"
                    value={modalEditar.cargo || ""}
                    onChange={(e) =>
                      setModalEditar({ ...modalEditar, cargo: e.target.value })
                    }
                  />
                </div>

                <div className="campo-form-modal" style={{ marginTop: "1rem" }}>
                  <label>Rol del Sistema:</label>
                  <div className="catalogo-roles-selector">
                    {catalogoRoles.map((r) => {
                      const esAdminPpal = modalEditar.email.toLowerCase() === ADMIN_PRINCIPAL.toLowerCase();
                      const bloqueado = esAdminPpal && r.id !== "ADMINISTRADOR";

                      return (
                        <div
                          key={r.id}
                          className={`tarjeta-rol-opcion ${
                            modalEditar.rol === r.id ? "seleccionado" : ""
                          } ${bloqueado ? "bloqueado" : ""}`}
                          onClick={() => {
                            if (!bloqueado) {
                              setModalEditar({ ...modalEditar, rol: r.id });
                            }
                          }}
                        >
                          <div className="rol-opcion-header">
                            <span className="rol-icono">{r.icono}</span>
                            <strong>{r.nombre}</strong>
                          </div>
                          <p className="rol-desc">{r.descripcion}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {modalEditar.email.toLowerCase() !== ADMIN_PRINCIPAL.toLowerCase() && (
                  <div className="campo-form-modal" style={{ marginTop: "1rem" }}>
                    <label className="checkbox-toggle-label">
                      <input
                        type="checkbox"
                        checked={modalEditar.activo}
                        onChange={(e) =>
                          setModalEditar({ ...modalEditar, activo: e.target.checked })
                        }
                      />
                      <span>Usuario activo</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancelar-modal"
                  onClick={() => setModalEditar(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-confirmar-aprobar"
                  disabled={guardando}
                >
                  {guardando ? "Guardando..." : "Actualizar Rol"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
