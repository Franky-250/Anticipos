import { useEffect, useState, useMemo } from "react";
import {
  obtenerConfiguracionTope,
  actualizarConfiguracionTope,
  obtenerColaboradoresSegmentados,
} from "../api";
import { useAuth } from "../context/AuthContext";
import SearchableSelect from "../components/SearchableSelect";

const ADMIN_PRINCIPAL = "jheyson.mena@pcmejia.com.co";

const formatoMoneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function Topes() {
  const { user } = useAuth();
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [notificacion, setNotificacion] = useState(null);

  const [montoTope, setMontoTope] = useState("1500000");
  const [reglaActiva, setReglaActiva] = useState(true);
  const [descripcion, setDescripcion] = useState("");
  const [autorizadores, setAutorizadores] = useState([]);
  const [colaboradoresCronos, setColaboradoresCronos] = useState([]);

  // Estado para el selector de añadir autorizador
  const [colabSeleccionado, setColabSeleccionado] = useState("");

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
      const [configData, segData] = await Promise.all([
        obtenerConfiguracionTope(),
        obtenerColaboradoresSegmentados().catch(() => ({ todos: [] })),
      ]);

      if (configData) {
        setMontoTope(String(configData.monto_tope || "1500000").split(".")[0]);
        setReglaActiva(Boolean(configData.activo));
        setDescripcion(configData.descripcion || "Tope estándar para anticipos de obra");
        setAutorizadores(configData.autorizadores || []);
      }
      setColaboradoresCronos(segData.todos || []);
    } catch (err) {
      console.error("Error al cargar configuración de topes:", err);
      setError("No se pudo cargar la configuración de topes.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

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

  const handleMontoChange = (e) => {
    const limpio = e.target.value.replace(/\D/g, "");
    setMontoTope(limpio);
  };

  const handleAgregarAutorizador = () => {
    if (!colabSeleccionado) return;
    const encontrado = opcionesColaboradores.find(
      (op) => op.codigo === colabSeleccionado || op.nombre === colabSeleccionado
    );
    if (!encontrado) return;

    // Verificar si ya está en la lista
    const yaExiste = autorizadores.some(
      (a) =>
        (a.email && a.email.toLowerCase() === encontrado.email.toLowerCase()) ||
        a.nombre === encontrado.nombre
    );

    if (yaExiste) {
      mostrarNotif("error", "Este colaborador ya se encuentra en la lista de autorizadores de sobretope.");
      return;
    }

    const nuevo = {
      nombre: encontrado.nombre,
      cargo: encontrado.cargo || "",
      email: encontrado.email || "",
      cedula: encontrado.cedula || "",
    };

    setAutorizadores([...autorizadores, nuevo]);
    setColabSeleccionado("");
    mostrarNotif("exito", `Se añadió a ${encontrado.nombre} a la lista de sobretope.`);
  };

  const handleEliminarAutorizador = (index) => {
    const nuevaLista = autorizadores.filter((_, idx) => idx !== index);
    setAutorizadores(nuevaLista);
  };

  const handleGuardarConfiguracion = async (e) => {
    e.preventDefault();
    const valorNumerico = parseFloat(montoTope);
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      mostrarNotif("error", "Por favor ingresa un monto tope válido mayor a cero.");
      return;
    }

    try {
      setGuardando(true);
      await actualizarConfiguracionTope({
        monto_tope: valorNumerico,
        activo: reglaActiva,
        descripcion: descripcion.trim(),
        autorizadores: autorizadores,
      });

      mostrarNotif("exito", "¡Configuración de topes guardada exitosamente!");
    } catch (err) {
      console.error("Error al guardar configuración:", err);
      mostrarNotif("error", err.message || "Error al guardar configuración de topes.");
    } finally {
      setGuardando(false);
    }
  };

  if (!esAdmin) {
    return (
      <div className="accesos-restringido-page">
        <div className="tarjeta-restringido">
          <span className="icono-restringido">🔒</span>
          <h2>Acceso Restringido</h2>
          <p>
            La configuración de topes y sobretope es de uso exclusivo para los <strong>Administradores del Sistema</strong>.
          </p>
          <div className="info-sesion-actual">
            <span>Usuario: <strong>{user?.name || user?.email}</strong></span>
            <span>Rol actual: <strong>{user?.rol || "SOLICITANTE"}</strong></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="topes-page">
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
          <h2>Configuración de Topes y Pre-Autorización de Sobretope</h2>
          <p>
            Control del límite máximo estándar de anticipos y pool de personas autorizadas para autorizar montos excepcionales.
          </p>
        </div>
      </div>

      {/* KPIs de Control */}
      <div className="colaboradores-kpis">
        <div className="kpi-card">
          <div className="kpi-icono">💰</div>
          <div className="kpi-info">
            <span className="kpi-valor">
              {montoTope ? formatoMoneda.format(Number(montoTope)) : "$0"}
            </span>
            <span className="kpi-label">Monto Tope Estándar</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icono">{reglaActiva ? "🟢" : "⚪"}</div>
          <div className="kpi-info">
            <span className="kpi-valor">{reglaActiva ? "Activa" : "Pausada"}</span>
            <span className="kpi-label">Estado de la Regla</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icono">👥</div>
          <div className="kpi-info">
            <span className="kpi-valor">{autorizadores.length}</span>
            <span className="kpi-label">Autorizadores de Sobretope</span>
          </div>
        </div>
      </div>

      {/* Formulario Principal de Configuración */}
      {cargando ? (
        <div className="colaboradores-cargando">
          <div className="spinner"></div>
          <p>Cargando configuración de topes...</p>
        </div>
      ) : error ? (
        <p className="mensaje mensaje-error">{error}</p>
      ) : (
        <form onSubmit={handleGuardarConfiguracion} className="topes-config-form">
          <div className="tarjeta-config-seccion">
            <h3>⚙️ Parámetros Generales de la Regla</h3>
            <p className="seccion-desc">
              Si una solicitud supera este valor, el solicitante deberá elegir a uno de los autorizadores de sobretope configurados antes de ingresar al flujo de aprobación.
            </p>

            <div className="form-grid-2cols">
              <div className="campo-form-modal">
                <label>Monto Límite Estándar (COP):</label>
                <div className="input-monto-wrapper">
                  <span className="input-monto-simbolo">$</span>
                  <input
                    type="text"
                    value={montoTope ? Number(montoTope).toLocaleString("es-CO") : ""}
                    onChange={handleMontoChange}
                    placeholder="1.500.000"
                    required
                  />
                </div>
                <span className="ayuda-input-txt">
                  Valor actual configurado: <strong>{montoTope ? formatoMoneda.format(Number(montoTope)) : "$0"}</strong>
                </span>
              </div>

              <div className="campo-form-modal">
                <label>Descripción / Observación de la Regla:</label>
                <input
                  type="text"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej. Tope estándar para anticipos de obra"
                />
              </div>
            </div>

            <div className="campo-form-modal" style={{ marginTop: "1rem" }}>
              <label className="checkbox-toggle-label">
                <input
                  type="checkbox"
                  checked={reglaActiva}
                  onChange={(e) => setReglaActiva(e.target.checked)}
                />
                <span>Exigir regla de sobretope para todas las solicitudes que superen este valor</span>
              </label>
            </div>
          </div>

          {/* Sección de Personas Autorizadas para Sobretope */}
          <div className="tarjeta-config-seccion" style={{ marginTop: "1.5rem" }}>
            <div className="seccion-header-flex">
              <div>
                <h3>👥 Personas Autorizadas para Avalar Sobretope</h3>
                <p className="seccion-desc">
                  Selecciona a las personas de la organización (según Cronos / Maestra) que los solicitantes podrán escoger para autorizar el monto cuando superen el tope.
                </p>
              </div>
              <span className="badge-contador-autorizadores">
                {autorizadores.length} persona(s) asignada(s)
              </span>
            </div>

            {/* Selector para añadir autorizador */}
            <div className="agregar-autorizador-sobretope-bar">
              <div className="select-wrap-autorizador">
                <SearchableSelect
                  options={opcionesColaboradores}
                  value={colabSeleccionado}
                  onChange={(val) => setColabSeleccionado(val)}
                  placeholder="Buscar colaborador en Cronos por nombre, cargo o cédula..."
                  valueKey="codigo"
                  labelKey="nombre"
                />
              </div>
              <button
                type="button"
                className="btn-add-autorizador"
                disabled={!colabSeleccionado}
                onClick={handleAgregarAutorizador}
              >
                ➕ Añadir a la Lista
              </button>
            </div>

            {/* Grid de Personas Autorizadas */}
            {autorizadores.length === 0 ? (
              <div className="flujo-timeline-vacio" style={{ margin: "1rem 0" }}>
                <p>
                  No hay personas asignadas para autorizar sobretope. Si la lista está vacía, el sistema permitirá seleccionar a cualquier director o autorizador activo.
                </p>
              </div>
            ) : (
              <div className="grid-autorizadores-sobretope">
                {autorizadores.map((aut, idx) => (
                  <div key={idx} className="card-autorizador-item">
                    <div className="avatar-autorizador-item">
                      {aut.nombre?.charAt(0).toUpperCase() || "A"}
                    </div>
                    <div className="info-autorizador-item">
                      <strong>{aut.nombre}</strong>
                      <span className="cargo-autorizador">{aut.cargo || "Sin cargo registrado"}</span>
                      {aut.email && <span className="email-autorizador">✉️ {aut.email}</span>}
                    </div>
                    <button
                      type="button"
                      className="btn-quitar-autorizador"
                      onClick={() => handleEliminarAutorizador(idx)}
                      title="Quitar de la lista de sobretope"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botón Guardar */}
          <div className="topes-form-actions">
            <button
              type="submit"
              className="btn-guardar-topes"
              disabled={guardando}
            >
              {guardando ? "Guardando Configuración..." : "💾 Guardar Configuración de Topes"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
