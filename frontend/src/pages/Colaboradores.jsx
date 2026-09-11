import { useState, useEffect, useMemo } from "react";
import {
  obtenerColaboradoresSegmentados,
  listarFlujosAprobacion,
  crearFlujoAprobacion,
  actualizarFlujoAprobacion,
  eliminarFlujoAprobacion,
  listarCargos,
} from "../api";
import SearchableSelect from "../components/SearchableSelect";

export default function Colaboradores() {
  const [tabActiva, setTabActiva] = useState("flujos"); // flujos, residentes, directores, todos
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [notificacion, setNotificacion] = useState(null);

  // Datos del backend
  const [estadisticas, setEstadisticas] = useState({
    total_colaboradores: 0,
    total_residentes: 0,
    total_directores: 0,
    total_flujos: 0,
  });
  const [residentes, setResidentes] = useState([]);
  const [directores, setDirectores] = useState([]);
  const [todos, setTodos] = useState([]);
  const [flujos, setFlujos] = useState([]);
  const [listaCargosMaestra, setListaCargosMaestra] = useState([]);

  // Búsquedas en pestañas
  const [busquedaResidentes, setBusquedaResidentes] = useState("");
  const [busquedaDirectores, setBusquedaDirectores] = useState("");
  const [busquedaTodos, setBusquedaTodos] = useState("");

  // Estado del flujo seleccionado en el constructor
  const [flujoSeleccionadoId, setFlujoSeleccionadoId] = useState(null);
  const [flujoEdicion, setFlujoEdicion] = useState(null);
  const [guardandoFlujo, setGuardandoFlujo] = useState(false);

  // Modal para nuevo flujo
  const [modalNuevoFlujo, setModalNuevoFlujo] = useState(false);
  const [nuevoFlujoNombre, setNuevoFlujoNombre] = useState("");
  const [nuevoFlujoDesc, setNuevoFlujoDesc] = useState("");
  const [nuevoFlujoTipo, setNuevoFlujoTipo] = useState("personalizado");
  const [nuevoAplicaOtros, setNuevoAplicaOtros] = useState(false);  // Estado para agregar aprobador en flujo activo
  const [colaboradorParaAgregar, setColaboradorParaAgregar] = useState("");
  const [rolPasoNuevo, setRolPasoNuevo] = useState("");
  const [pasoEsDinamico, setPasoEsDinamico] = useState(false);

  // Estado para agregar cargo al flujo activo
  const [cargoSeleccionadoParaAgregar, setCargoSeleccionadoParaAgregar] = useState("");

  // Cargar datos
  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError(null);
      const [segData, flujosData, cargosData] = await Promise.all([
        obtenerColaboradoresSegmentados(),
        listarFlujosAprobacion(),
        listarCargos().catch(() => []),
      ]);

      setEstadisticas(segData.estadisticas || {});
      setResidentes(segData.residentes || []);
      setDirectores(segData.directores || []);
      setTodos(segData.todos || []);
      setFlujos(flujosData || []);
      setListaCargosMaestra(cargosData || []);

      if (flujosData && flujosData.length > 0) {
        if (!flujoSeleccionadoId || !flujosData.find((f) => f.id === flujoSeleccionadoId)) {
          setFlujoSeleccionadoId(flujosData[0].id);
          setFlujoEdicion(JSON.parse(JSON.stringify(flujosData[0])));
        } else {
          const actual = flujosData.find((f) => f.id === flujoSeleccionadoId);
          setFlujoEdicion(JSON.parse(JSON.stringify(actual)));
        }
      } else {
        setFlujoSeleccionadoId(null);
        setFlujoEdicion(null);
      }
    } catch (err) {
      console.error("Error al cargar datos de colaboradores:", err);
      setError("No se pudieron cargar los colaboradores o flujos. Intente de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Cambiar flujo seleccionado
  const seleccionarFlujo = (flujo) => {
    setFlujoSeleccionadoId(flujo.id);
    setFlujoEdicion(JSON.parse(JSON.stringify(flujo)));
  };

  // Mostrar alerta temporal
  const mostrarNotificacion = (tipo, mensaje) => {
    setNotificacion({ tipo, mensaje });
    setTimeout(() => {
      setNotificacion(null);
    }, 4000);
  };

  // Opciones formateadas de todos los colaboradores para SearchableSelect
  const opcionesTodosColaboradores = useMemo(() => {
    return todos.map((c) => ({
      codigo: c.cedula || c.nombre,
      nombre: c.nombre,
      cargo: c.cargo || "Sin Cargo",
      email: c.email || "",
      centro: c.centro_nombre || "",
      objetoOriginal: c,
    }));
  }, [todos]);

  // Lista consolidada y filtrada de cargos de la maestra para SearchableSelect
  const opcionesCargosDisponibles = useMemo(() => {
    const cargosSet = new Set(listaCargosMaestra || []);
    todos.forEach((t) => {
      if (t.cargo && t.cargo.trim()) {
        cargosSet.add(t.cargo.trim());
      }
    });

    const cargosArray = Array.from(cargosSet).sort((a, b) => a.localeCompare(b));
    const asignados = flujoEdicion?.cargos_asociados || [];

    return cargosArray
      .filter((c) => !asignados.includes(c))
      .map((c) => ({
        codigo: c,
        nombre: c,
      }));
  }, [listaCargosMaestra, todos, flujoEdicion?.cargos_asociados]);

  // Manejadores de cargos asociados al flujo
  const agregarCargoAFlujo = (cargo) => {
    if (!cargo || !flujoEdicion) return;
    const cargosActuales = flujoEdicion.cargos_asociados || [];
    if (!cargosActuales.includes(cargo)) {
      setFlujoEdicion({
        ...flujoEdicion,
        cargos_asociados: [...cargosActuales, cargo],
      });
    }
    setCargoSeleccionadoParaAgregar("");
  };

  const eliminarCargoDeFlujo = (cargo) => {
    if (!flujoEdicion) return;
    const nuevosCargos = (flujoEdicion.cargos_asociados || []).filter((c) => c !== cargo);
    setFlujoEdicion({
      ...flujoEdicion,
      cargos_asociados: nuevosCargos,
    });
  };

  // Estado para agregar suplentes por paso
  const [opcionalSelectPorPaso, setOpcionalSelectPorPaso] = useState({});

  const agregarAprobadorOpcionalAPaso = (indicePaso) => {
    if (!flujoEdicion) return;
    const colabValor = opcionalSelectPorPaso[indicePaso];
    if (!colabValor) return;

    const colabObj = todos.find(
      (c) => (c.cedula || c.nombre) === colabValor || c.nombre === colabValor
    );
    if (!colabObj) return;

    const nuevosPasos = [...flujoEdicion.pasos];
    const paso = { ...nuevosPasos[indicePaso] };
    const opcionalesActuales = paso.aprobadores_opcionales ? [...paso.aprobadores_opcionales] : [];

    // Validar si ya es el aprobador principal
    if (paso.nombre_aprobador === colabObj.nombre || (paso.cedula_aprobador && paso.cedula_aprobador === colabObj.cedula)) {
      mostrarNotificacion("error", "Este colaborador ya es el aprobador principal de este paso.");
      return;
    }

    // Validar si ya existe como opcional
    const yaExiste = opcionalesActuales.some(
      (opc) => (opc.cedula && opc.cedula === colabObj.cedula) || opc.nombre === colabObj.nombre
    );
    if (yaExiste) {
      mostrarNotificacion("error", "Este colaborador ya está registrado como opcional en este paso.");
      return;
    }

    opcionalesActuales.push({
      nombre: colabObj.nombre,
      cargo: colabObj.cargo || "",
      cedula: colabObj.cedula || "",
      email: colabObj.email || colabObj.correo || "",
    });

    paso.aprobadores_opcionales = opcionalesActuales;
    nuevosPasos[indicePaso] = paso;
    setFlujoEdicion({ ...flujoEdicion, pasos: nuevosPasos });
    setOpcionalSelectPorPaso((prev) => ({ ...prev, [indicePaso]: "" }));
  };

  const eliminarAprobadorOpcionalDePaso = (indicePaso, opcIdx) => {
    if (!flujoEdicion) return;
    const nuevosPasos = [...flujoEdicion.pasos];
    const paso = { ...nuevosPasos[indicePaso] };
    const opcionalesActuales = (paso.aprobadores_opcionales || []).filter((_, idx) => idx !== opcIdx);
    paso.aprobadores_opcionales = opcionalesActuales;
    nuevosPasos[indicePaso] = paso;
    setFlujoEdicion({ ...flujoEdicion, pasos: nuevosPasos });
  };

  // Manejadores de pasos del flujo
  const moverPasoArriba = (indice) => {
    if (indice === 0 || !flujoEdicion) return;
    const nuevosPasos = [...flujoEdicion.pasos];
    const temp = nuevosPasos[indice - 1];
    nuevosPasos[indice - 1] = nuevosPasos[indice];
    nuevosPasos[indice] = temp;

    nuevosPasos.forEach((p, idx) => {
      p.orden = idx + 1;
    });

    setFlujoEdicion({ ...flujoEdicion, pasos: nuevosPasos });
  };

  const moverPasoAbajo = (indice) => {
    if (!flujoEdicion || indice >= flujoEdicion.pasos.length - 1) return;
    const nuevosPasos = [...flujoEdicion.pasos];
    const temp = nuevosPasos[indice + 1];
    nuevosPasos[indice + 1] = nuevosPasos[indice];
    nuevosPasos[indice] = temp;

    nuevosPasos.forEach((p, idx) => {
      p.orden = idx + 1;
    });

    setFlujoEdicion({ ...flujoEdicion, pasos: nuevosPasos });
  };

  const eliminarPaso = (indice) => {
    if (!flujoEdicion) return;
    const nuevosPasos = flujoEdicion.pasos.filter((_, idx) => idx !== indice);
    nuevosPasos.forEach((p, idx) => {
      p.orden = idx + 1;
    });
    setFlujoEdicion({ ...flujoEdicion, pasos: nuevosPasos });
  };

  const cambiarRolPaso = (indice, nuevoRol) => {
    if (!flujoEdicion) return;
    const nuevosPasos = [...flujoEdicion.pasos];
    nuevosPasos[indice].rol_nivel = nuevoRol;
    setFlujoEdicion({ ...flujoEdicion, pasos: nuevosPasos });
  };

  const agregarPaso = () => {
    if (!pasoEsDinamico && !colaboradorParaAgregar) return;
    if (!flujoEdicion) return;

    let nombre = "";
    let cargo = "";
    let cedula = "";

    if (pasoEsDinamico) {
      nombre = "Persona seleccionada en la solicitud";
      cargo = "Director / Autorizador elegido en la solicitud";
      cedula = "";
    } else {
      const colabObj = todos.find(
        (c) => (c.cedula || c.nombre) === colaboradorParaAgregar || c.nombre === colaboradorParaAgregar
      );
      nombre = colabObj ? colabObj.nombre : colaboradorParaAgregar;
      cargo = colabObj ? colabObj.cargo : "";
      cedula = colabObj ? colabObj.cedula : "";
    }

    const nuevoPaso = {
      orden: (flujoEdicion.pasos || []).length + 1,
      nombre_aprobador: nombre,
      cargo_aprobador: cargo,
      cedula_aprobador: cedula,
      rol_nivel:
        rolPasoNuevo.trim() ||
        (pasoEsDinamico ? "Autorizador de la Solicitud" : `Paso ${(flujoEdicion.pasos || []).length + 1}`),
      es_dinamico_solicitud: pasoEsDinamico,
      aprobadores_opcionales: [],
    };

    setFlujoEdicion({
      ...flujoEdicion,
      pasos: [...(flujoEdicion.pasos || []), nuevoPaso],
    });

    setColaboradorParaAgregar("");
    setPasoEsDinamico(false);
    setRolPasoNuevo("");
  };

  // Guardar cambios del flujo en edición
  const guardarFlujo = async () => {
    if (!flujoEdicion) return;
    try {
      setGuardandoFlujo(true);
      const payload = {
        nombre: flujoEdicion.nombre,
        descripcion: flujoEdicion.descripcion,
        tipo_flujo: flujoEdicion.tipo_flujo,
        notificar_a_nombre: flujoEdicion.notificar_a_nombre,
        notificar_a_cargo: flujoEdicion.notificar_a_cargo,
        notificar_a_email: flujoEdicion.notificar_a_email,
        cargos_asociados: flujoEdicion.cargos_asociados || [],
        aplica_a_otros_cargos: Boolean(flujoEdicion.aplica_a_otros_cargos),
        es_predeterminado: Boolean(flujoEdicion.es_predeterminado),
        activo: Boolean(flujoEdicion.activo),
        pasos: (flujoEdicion.pasos || []).map((p, idx) => ({
          orden: idx + 1,
          nombre_aprobador: p.nombre_aprobador,
          cargo_aprobador: p.cargo_aprobador || "",
          cedula_aprobador: p.cedula_aprobador || "",
          rol_nivel: p.rol_nivel || `Paso ${idx + 1}`,
          es_dinamico_solicitud: Boolean(p.es_dinamico_solicitud || p.nombre_aprobador === "Persona seleccionada en la solicitud"),
          aprobadores_opcionales: p.aprobadores_opcionales || [],
        })),
      };

      const flujoActualizado = await actualizarFlujoAprobacion(flujoEdicion.id, payload);
      setFlujoEdicion(JSON.parse(JSON.stringify(flujoActualizado)));

      // Actualizar en lista local
      setFlujos((prev) =>
        prev.map((f) => (f.id === flujoActualizado.id ? flujoActualizado : f))
      );

      mostrarNotificacion("exito", "¡Flujo de aprobación guardado exitosamente!");
    } catch (err) {
      console.error("Error al guardar flujo:", err);
      mostrarNotificacion("error", "Error al guardar el flujo. " + (err.message || ""));
    } finally {
      setGuardandoFlujo(false);
    }
  };

  // Crear nuevo flujo
  const handleCrearNuevoFlujo = async (e) => {
    e.preventDefault();
    if (!nuevoFlujoNombre.trim()) return;

    try {
      setGuardandoFlujo(true);
      const nuevo = await crearFlujoAprobacion({
        nombre: nuevoFlujoNombre.trim(),
        descripcion: nuevoFlujoDesc.trim() || "Flujo de aprobación",
        tipo_flujo: nuevoFlujoTipo,
        notificar_a_nombre: "",
        notificar_a_cargo: "",
        notificar_a_email: "",
        cargos_asociados: [],
        aplica_a_otros_cargos: nuevoAplicaOtros,
        es_predeterminado: false,
        activo: true,
        pasos: [],
      });

      setFlujos((prev) => [...prev, nuevo]);
      setFlujoSeleccionadoId(nuevo.id);
      setFlujoEdicion(JSON.parse(JSON.stringify(nuevo)));
      setModalNuevoFlujo(false);
      setNuevoFlujoNombre("");
      setNuevoFlujoDesc("");
      setNuevoAplicaOtros(false);
      mostrarNotificacion("exito", "¡Nuevo flujo de aprobación creado exitosamente!");
    } catch (err) {
      console.error("Error al crear nuevo flujo:", err);
      mostrarNotificacion("error", "No se pudo crear el flujo: " + err.message);
    } finally {
      setGuardandoFlujo(false);
    }
  };

  // Eliminar cualquier flujo
  const handleEliminarFlujo = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar el flujo "${nombre}"? Esta acción no se puede deshacer.`)) return;

    try {
      await eliminarFlujoAprobacion(id);
      const restantes = flujos.filter((f) => f.id !== id);
      setFlujos(restantes);
      if (restantes.length > 0) {
        setFlujoSeleccionadoId(restantes[0].id);
        setFlujoEdicion(JSON.parse(JSON.stringify(restantes[0])));
      } else {
        setFlujoSeleccionadoId(null);
        setFlujoEdicion(null);
      }
      mostrarNotificacion("exito", "Flujo eliminado correctamente");
    } catch (err) {
      console.error("Error al eliminar flujo:", err);
      mostrarNotificacion("error", "No se pudo eliminar el flujo.");
    }
  };

  // Filtrado de listas de colaboradores
  const residentesFiltrados = useMemo(() => {
    const q = busquedaResidentes.toLowerCase().trim();
    if (!q) return residentes;
    return residentes.filter(
      (r) =>
        r.nombre.toLowerCase().includes(q) ||
        r.cedula.toLowerCase().includes(q) ||
        r.cargo.toLowerCase().includes(q) ||
        r.centro_nombre.toLowerCase().includes(q) ||
        r.empresa.toLowerCase().includes(q)
    );
  }, [residentes, busquedaResidentes]);

  const directoresFiltrados = useMemo(() => {
    const q = busquedaDirectores.toLowerCase().trim();
    if (!q) return directores;
    return directores.filter(
      (d) =>
        d.nombre.toLowerCase().includes(q) ||
        d.cedula.toLowerCase().includes(q) ||
        d.cargo.toLowerCase().includes(q) ||
        d.centro_nombre.toLowerCase().includes(q) ||
        d.empresa.toLowerCase().includes(q)
    );
  }, [directores, busquedaDirectores]);

  const todosFiltrados = useMemo(() => {
    const q = busquedaTodos.toLowerCase().trim();
    if (!q) return todos;
    return todos.filter(
      (t) =>
        t.nombre.toLowerCase().includes(q) ||
        t.cedula.toLowerCase().includes(q) ||
        t.cargo.toLowerCase().includes(q) ||
        t.centro_nombre.toLowerCase().includes(q)
    );
  }, [todos, busquedaTodos]);

  if (cargando && flujos.length === 0 && todos.length === 0) {
    return (
      <div className="colaboradores-cargando">
        <div className="spinner"></div>
        <p>Cargando módulo de colaboradores y flujos de aprobación...</p>
      </div>
    );
  }

  return (
    <div className="colaboradores-page">
      {/* Toast Notification */}
      {notificacion && (
        <div className={`toast-alerta toast-${notificacion.tipo}`}>
          <span>{notificacion.tipo === "exito" ? "✅" : "⚠️"}</span>
          <span>{notificacion.mensaje}</span>
        </div>
      )}

      {/* Encabezado y KPIs */}
      <div className="colaboradores-header">
        <div>
          <h2>Gestión de Colaboradores y Flujos de Aprobación</h2>
          <p className="subtitulo-header">
            Personal sincronizado desde la maestra de Cronos y configuración inteligente de flujos según el cargo del solicitante.
          </p>
        </div>
      </div>

      {/* Métricas / KPIs */}
      <div className="colaboradores-kpis">
        <div className="kpi-card kpi-total">
          <div className="kpi-icono">👥</div>
          <div className="kpi-info">
            <span className="kpi-valor">{estadisticas.total_colaboradores || todos.length}</span>
            <span className="kpi-label">Total en Maestra</span>
          </div>
        </div>

        <div className="kpi-card kpi-residentes">
          <div className="kpi-icono">🏗️</div>
          <div className="kpi-info">
            <span className="kpi-valor">{estadisticas.total_residentes || residentes.length}</span>
            <span className="kpi-label">Residentes / Obra</span>
          </div>
        </div>

        <div className="kpi-card kpi-directores">
          <div className="kpi-icono">👔</div>
          <div className="kpi-info">
            <span className="kpi-valor">{estadisticas.total_directores || directores.length}</span>
            <span className="kpi-label">Directores / Gerencia</span>
          </div>
        </div>

        <div className="kpi-card kpi-flujos">
          <div className="kpi-icono">⚡</div>
          <div className="kpi-info">
            <span className="kpi-valor">{flujos.length}</span>
            <span className="kpi-label">Flujos Creados</span>
          </div>
        </div>
      </div>

      {/* Navegación por pestañas */}
      <div className="colaboradores-tabs">
        <button
          className={`colab-tab-btn ${tabActiva === "flujos" ? "activo" : ""}`}
          onClick={() => setTabActiva("flujos")}
        >
          <span className="tab-icon">⚡</span>
          Flujos y Aprobadores
          <span className="tab-badge">{flujos.length}</span>
        </button>

        <button
          className={`colab-tab-btn ${tabActiva === "residentes" ? "activo" : ""}`}
          onClick={() => setTabActiva("residentes")}
        >
          <span className="tab-icon">🏗️</span>
          Residentes de Obra
          <span className="tab-badge">{residentes.length}</span>
        </button>

        <button
          className={`colab-tab-btn ${tabActiva === "directores" ? "activo" : ""}`}
          onClick={() => setTabActiva("directores")}
        >
          <span className="tab-icon">👔</span>
          Directores y Directivos
          <span className="tab-badge">{directores.length}</span>
        </button>

        <button
          className={`colab-tab-btn ${tabActiva === "todos" ? "activo" : ""}`}
          onClick={() => setTabActiva("todos")}
        >
          <span className="tab-icon">📋</span>
          Todos ({todos.length})
        </button>
      </div>

      {/* ========================================== */}
      {/* PESTAÑA 1: CONSTRUCTOR DE FLUJOS */}
      {/* ========================================== */}
      {tabActiva === "flujos" && (
        <div className="flujos-constructor-layout">
          {/* Barra lateral / selector de flujo */}
          <div className="flujos-sidebar-card">
            <div className="flujos-sidebar-header">
              <h3>Flujos de Aprobación</h3>
              <button
                className="btn-nuevo-flujo"
                onClick={() => setModalNuevoFlujo(true)}
                title="Crear nuevo flujo"
              >
                + Nuevo Flujo
              </button>
            </div>
            <p className="flujos-sidebar-desc">
              Crea y configura las cadenas de aprobación según los cargos de los solicitantes:
            </p>

            {flujos.length === 0 ? (
              <div className="flujos-sidebar-vacio">
                <p>No tienes flujos configurados.</p>
                <button
                  className="btn-crear-primer-flujo"
                  onClick={() => setModalNuevoFlujo(true)}
                >
                  + Crear Primer Flujo
                </button>
              </div>
            ) : (
              <div className="flujos-lista">
                {flujos.map((flujo) => {
                  const esActivo = flujo.id === flujoSeleccionadoId;
                  return (
                    <div
                      key={flujo.id}
                      className={`flujo-item-selector ${esActivo ? "activo" : ""}`}
                      onClick={() => seleccionarFlujo(flujo)}
                    >
                      <div className="flujo-item-header">
                        <span className="flujo-item-nombre">{flujo.nombre}</span>
                        {flujo.aplica_a_otros_cargos && (
                          <span className="badge-comodin">Comodín</span>
                        )}
                      </div>
                      <p className="flujo-item-desc">{flujo.descripcion || "Sin descripción"}</p>
                      <div className="flujo-item-meta">
                        <span>🔗 {flujo.pasos?.length || 0} pasos</span>
                        {flujo.cargos_asociados?.length > 0 && (
                          <span>🎯 {flujo.cargos_asociados.length} cargos</span>
                        )}
                        {flujo.aplica_a_otros_cargos && (
                          <span className="tag-otros-cargos">🌐 Todos los demás</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Constructor y Editor Visual */}
          {flujoEdicion ? (
            <div className="flujo-editor-panel">
              <div className="flujo-editor-header">
                <div className="flujo-editor-titulo-box">
                  <input
                    type="text"
                    className="flujo-input-nombre"
                    value={flujoEdicion.nombre}
                    onChange={(e) =>
                      setFlujoEdicion({ ...flujoEdicion, nombre: e.target.value })
                    }
                    placeholder="Nombre del Flujo de Aprobación"
                  />
                  <input
                    type="text"
                    className="flujo-input-desc"
                    value={flujoEdicion.descripcion || ""}
                    onChange={(e) =>
                      setFlujoEdicion({ ...flujoEdicion, descripcion: e.target.value })
                    }
                    placeholder="Descripción o propósito de este flujo"
                  />
                </div>

                <div className="flujo-editor-top-acciones">
                  <button
                    className="btn-eliminar-flujo"
                    onClick={() =>
                      handleEliminarFlujo(flujoEdicion.id, flujoEdicion.nombre)
                    }
                    title="Eliminar este flujo"
                  >
                    🗑️ Eliminar Flujo
                  </button>
                  <button
                    className="btn-guardar-flujo"
                    onClick={guardarFlujo}
                    disabled={guardandoFlujo}
                  >
                    {guardandoFlujo ? "Guardando..." : "💾 Guardar Flujo"}
                  </button>
                </div>
              </div>

              {/* ========================================== */}
              {/* CONFIGURACIÓN DE CARGOS QUE APLICAN A ESTE FLUJO */}
              {/* ========================================== */}
              <div className="cargos-config-box">
                <div className="cargos-config-header">
                  <div className="cargos-config-titulo">
                    <span className="cargos-icono">🎯</span>
                    <div>
                      <h5>Cargos a los que Aplica este Flujo</h5>
                      <p>
                        Cuando una persona cree una solicitud de anticipo, el sistema verificará su cargo para asignarle este flujo de aprobación.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Opción Comodín: Aplica a todos los demás cargos */}
                <div className="opcion-comodin-wrapper">
                  <label className="checkbox-comodin-label">
                    <input
                      type="checkbox"
                      checked={Boolean(flujoEdicion.aplica_a_otros_cargos)}
                      onChange={(e) =>
                        setFlujoEdicion({
                          ...flujoEdicion,
                          aplica_a_otros_cargos: e.target.checked,
                        })
                      }
                    />
                    <div className="checkbox-comodin-texto">
                      <strong>Incluye a todos los cargos, menos los cargos que ya tienen flujo</strong>
                      <span>
                        Cualquier solicitud cuyo cargo no tenga un flujo específico configurado pasará automáticamente por este flujo.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Selección de cargos específicos */}
                <div className="cargos-selector-area">
                  <label className="cargos-subtitulo">
                    Cargos específicos asignados a este flujo:
                  </label>

                  <div className="agregar-cargo-input-group">
                    <SearchableSelect
                      options={opcionesCargosDisponibles}
                      value={cargoSeleccionadoParaAgregar}
                      onChange={(val) => {
                        if (val) {
                          agregarCargoAFlujo(val);
                        }
                      }}
                      placeholder="Escribe para buscar y añadir cargo (ej. Residente, Maestro, Director)..."
                      searchPlaceholder="Filtrar por cargo..."
                      valueKey="codigo"
                      labelKey="nombre"
                    />
                  </div>

                  {/* Chips de cargos seleccionados */}
                  <div className="cargos-chips-container">
                    {(!flujoEdicion.cargos_asociados || flujoEdicion.cargos_asociados.length === 0) &&
                    !flujoEdicion.aplica_a_otros_cargos ? (
                      <p className="sin-cargos-aviso">
                        ⚠️ No has seleccionado cargos específicos. Selecciona uno arriba o marca la opción comodín para que aplique a los demás cargos.
                      </p>
                    ) : (
                      flujoEdicion.cargos_asociados?.map((cargo) => (
                        <div key={cargo} className="cargo-chip">
                          <span>{cargo}</span>
                          <button
                            type="button"
                            onClick={() => eliminarCargoDeFlujo(cargo)}
                            title={`Quitar cargo ${cargo}`}
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* ========================================== */}
              {/* CADENA VISUAL DE PASOS DE APROBACIÓN */}
              {/* ========================================== */}
              <div className="flujo-timeline-container">
                <div className="flujo-timeline-header">
                  <h4>
                    <span>⛓️</span> Cadena de Pasos de Aprobación
                  </h4>
                  <span className="timeline-badge-info">
                    {flujoEdicion.pasos?.length || 0} Aprobadores en secuencia
                  </span>
                </div>

                {(!flujoEdicion.pasos || flujoEdicion.pasos.length === 0) && (
                  <div className="flujo-timeline-vacio">
                    <p>No hay pasos configurados en este flujo. Agregue el primer aprobador abajo con el personal de la maestra.</p>
                  </div>
                )}

                <div className="flujo-pasos-lista">
                  {flujoEdicion.pasos?.map((paso, idx) => {
                    const esDinamico = Boolean(
                      paso.es_dinamico_solicitud ||
                      paso.nombre_aprobador === "Persona seleccionada en la solicitud"
                    );

                    return (
                      <div key={idx} className="flujo-paso-card-wrapper">
                        <div className={`flujo-paso-card ${esDinamico ? "paso-card-dinamico" : ""}`}>
                          <div className="paso-orden-badge">
                            <span className="paso-num">{idx + 1}</span>
                            <span className="paso-num-label">Paso</span>
                          </div>

                          <div className="paso-info-box">
                            <div className="paso-rol-input-wrap">
                              <input
                                type="text"
                                className="paso-rol-input"
                                value={paso.rol_nivel || ""}
                                onChange={(e) => cambiarRolPaso(idx, e.target.value)}
                                placeholder="Rol / Nivel de este paso (ej. Revisión Técnica en Obra)"
                              />
                            </div>

                            <div className="paso-aprobador-detalles">
                              {esDinamico ? (
                                <div className="paso-aprobador-dinamico-det">
                                  <span className="badge-paso-dinamico">⚡ Dinámico: ¿Quién autoriza?</span>
                                  <span className="paso-aprobador-dinamico-nota">
                                    Persona elegida por el solicitante en "¿Quién autoriza?"
                                  </span>
                                </div>
                              ) : (
                                <>
                                  <span className="paso-aprobador-nombre">
                                    👤 {paso.nombre_aprobador}
                                  </span>
                                  {paso.cargo_aprobador && (
                                    <span className="paso-aprobador-cargo">
                                      💼 {paso.cargo_aprobador}
                                    </span>
                                  )}
                                  {paso.cedula_aprobador && (
                                    <span className="paso-aprobador-cedula">
                                      🆔 CC: {paso.cedula_aprobador}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Sección de Aprobadores Opcionales / Suplentes */}
                            <div className="paso-opcionales-section">
                              <div className="paso-opcionales-header">
                                <span className="paso-opcionales-title">
                                  👥 Aprobadores Opcionales / Suplentes (en caso de ausencia):
                                </span>
                                <span className="paso-opcionales-badge-count">
                                  {(paso.aprobadores_opcionales || []).length} suplente(s)
                                </span>
                              </div>

                              {/* Lista de chips de suplentes asignados */}
                              {(paso.aprobadores_opcionales || []).length > 0 && (
                                <div className="paso-opcionales-chips">
                                  {paso.aprobadores_opcionales.map((opc, opcIdx) => (
                                    <div key={opcIdx} className="opcional-chip">
                                      <span className="opcional-chip-icon">👤</span>
                                      <div className="opcional-chip-info">
                                        <span className="opcional-chip-nombre">{opc.nombre}</span>
                                        {opc.cargo && (
                                          <span className="opcional-chip-cargo">({opc.cargo})</span>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        className="opcional-chip-remove"
                                        onClick={() => eliminarAprobadorOpcionalDePaso(idx, opcIdx)}
                                        title="Eliminar este suplente"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Selector para añadir suplente al paso */}
                              <div className="paso-opcional-add-row">
                                <div className="paso-opcional-select-wrap">
                                  <SearchableSelect
                                    options={opcionesTodosColaboradores}
                                    value={opcionalSelectPorPaso[idx] || ""}
                                    onChange={(val) =>
                                      setOpcionalSelectPorPaso((prev) => ({ ...prev, [idx]: val }))
                                    }
                                    placeholder="+ Seleccionar persona suplente..."
                                    valueKey="codigo"
                                    labelKey="nombre"
                                  />
                                </div>
                                <button
                                  type="button"
                                  className="btn-add-opcional"
                                  disabled={!opcionalSelectPorPaso[idx]}
                                  onClick={() => agregarAprobadorOpcionalAPaso(idx)}
                                >
                                  + Añadir Suplente
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="paso-acciones-btn">
                            <button
                              className="btn-orden-paso"
                              disabled={idx === 0}
                              onClick={() => moverPasoArriba(idx)}
                              title="Subir nivel"
                            >
                              ▲
                            </button>
                            <button
                              className="btn-orden-paso"
                              disabled={idx === flujoEdicion.pasos.length - 1}
                              onClick={() => moverPasoAbajo(idx)}
                              title="Bajar nivel"
                            >
                              ▼
                            </button>
                            <button
                              className="btn-eliminar-paso"
                              onClick={() => eliminarPaso(idx)}
                              title="Quitar este aprobador"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {/* Conector flecha visual entre pasos */}
                        {idx < flujoEdicion.pasos.length - 1 && (
                          <div className="paso-conector">
                            <div className="linea-conectora"></div>
                            <span className="flecha-conectora">➔ Siguiente nivel</span>
                            <div className="linea-conectora"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Formulario para agregar aprobador desde la maestra o dinámico */}
                <div className="agregar-aprobador-box">
                  <h5>➕ Agregar Aprobador a la Secuencia</h5>

                  {/* Opción Dinámica: Persona que se elige en la solicitud */}
                  <div className="opcion-paso-dinamico-bar">
                    <label className="checkbox-dinamico-label">
                      <input
                        type="checkbox"
                        checked={pasoEsDinamico}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setPasoEsDinamico(checked);
                          if (checked) {
                            setColaboradorParaAgregar("PERSONA_SOLICITUD");
                            if (!rolPasoNuevo) setRolPasoNuevo("Autorizador de la Solicitud");
                          } else {
                            setColaboradorParaAgregar("");
                            if (rolPasoNuevo === "Autorizador de la Solicitud") setRolPasoNuevo("");
                          }
                        }}
                      />
                      <div className="checkbox-dinamico-texto">
                        <strong>Persona que se elige en la solicitud</strong> (¿Quién autoriza?)
                        <span>
                          Marca esta opción para que este paso sea aprobado por quien se seleccione en la solicitud.
                        </span>
                      </div>
                    </label>
                  </div>

                  <div className="agregar-aprobador-form">
                    <div className="campo-form-flex select-colab-flex">
                      <label>
                        {pasoEsDinamico
                          ? "Aprobador Asignado Dinámicamente:"
                          : "Seleccionar Colaborador de Cronos / Maestra:"}
                      </label>
                      {pasoEsDinamico ? (
                        <div className="paso-dinamico-banner-info">
                          <span>⚡</span>
                          <span>
                            Se usará automáticamente el usuario seleccionado en <strong>¿Quién autoriza?</strong>
                          </span>
                        </div>
                      ) : (
                        <SearchableSelect
                          options={opcionesTodosColaboradores}
                          value={colaboradorParaAgregar}
                          onChange={(val) => setColaboradorParaAgregar(val)}
                          placeholder="Buscar por nombre, cargo o centro..."
                          valueKey="codigo"
                          labelKey="nombre"
                        />
                      )}
                    </div>

                    <div className="campo-form-flex rol-paso-flex">
                      <label>Etiqueta / Rol del Paso:</label>
                      <input
                        type="text"
                        value={rolPasoNuevo}
                        onChange={(e) => setRolPasoNuevo(e.target.value)}
                        placeholder="ej. Revisión Técnica en Obra"
                      />
                    </div>

                    <button
                      type="button"
                      className="btn-agregar-paso-submit"
                      onClick={agregarPaso}
                      disabled={!pasoEsDinamico && !colaboradorParaAgregar}
                    >
                      + Añadir Paso
                    </button>
                  </div>
                </div>

                {/* ========================================== */}
                {/* CONFIGURACIÓN DE NOTIFICACIÓN FINAL */}
                {/* ========================================== */}
                <div className="notificacion-final-box">
                  <div className="notificacion-final-header">
                    <div className="notif-icono-badge">🔔</div>
                    <div>
                      <h5>Notificación de Resultado Final del Flujo</h5>
                      <p>
                        Persona de la maestra a quien el sistema notificará una vez el
                        anticipo sea totalmente Aprobado o Rechazado por la cadena de pasos.
                      </p>
                    </div>
                  </div>

                  <div className="notificacion-final-form">
                    <div className="campo-notif">
                      <label>Buscar Responsable en la Maestra:</label>
                      <SearchableSelect
                        options={opcionesTodosColaboradores}
                        value={flujoEdicion.notificar_a_nombre || ""}
                        onChange={(val) => {
                          const col = todos.find(
                            (c) => (c.cedula || c.nombre) === val || c.nombre === val
                          );
                          if (col) {
                            setFlujoEdicion({
                              ...flujoEdicion,
                              notificar_a_nombre: col.nombre,
                              notificar_a_cargo: col.cargo || "",
                              notificar_a_email: col.email || "",
                            });
                          } else {
                            setFlujoEdicion({
                              ...flujoEdicion,
                              notificar_a_nombre: val,
                            });
                          }
                        }}
                        placeholder="Seleccione persona a notificar..."
                        valueKey="nombre"
                        labelKey="nombre"
                      />
                    </div>

                    <div className="campos-notif-grid">
                      <div className="campo-notif">
                        <label>Nombre del Responsable:</label>
                        <input
                          type="text"
                          value={flujoEdicion.notificar_a_nombre || ""}
                          onChange={(e) =>
                            setFlujoEdicion({
                              ...flujoEdicion,
                              notificar_a_nombre: e.target.value,
                            })
                          }
                          placeholder="Nombre y Apellidos"
                        />
                      </div>

                      <div className="campo-notif">
                        <label>Cargo:</label>
                        <input
                          type="text"
                          value={flujoEdicion.notificar_a_cargo || ""}
                          onChange={(e) =>
                            setFlujoEdicion({
                              ...flujoEdicion,
                              notificar_a_cargo: e.target.value,
                            })
                          }
                          placeholder="Cargo"
                        />
                      </div>

                      <div className="campo-notif">
                        <label>Correo Electrónico (Opcional):</label>
                        <input
                          type="email"
                          value={flujoEdicion.notificar_a_email || ""}
                          onChange={(e) =>
                            setFlujoEdicion({
                              ...flujoEdicion,
                              notificar_a_email: e.target.value,
                            })
                          }
                          placeholder="correo@ejemplo.com"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botón flotante inferior de guardar */}
                <div className="flujo-footer-acciones">
                  <button
                    className="btn-guardar-flujo-lg"
                    onClick={guardarFlujo}
                    disabled={guardandoFlujo}
                  >
                    {guardandoFlujo ? "Guardando Flujo..." : "💾 Guardar Todos los Cambios del Flujo"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flujo-editor-vacio">
              <p>No hay flujos seleccionados. Crea uno nuevo con el botón <strong>+ Nuevo Flujo</strong>.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* PESTAÑA 2: RESIDENTES */}
      {/* ========================================== */}
      {tabActiva === "residentes" && (
        <div className="colaboradores-tab-contenido">
          <div className="colab-busqueda-bar">
            <div className="input-busqueda-icono">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Buscar residente por nombre, cédula, obra o empresa..."
                value={busquedaResidentes}
                onChange={(e) => setBusquedaResidentes(e.target.value)}
              />
              {busquedaResidentes && (
                <button
                  className="btn-limpiar"
                  onClick={() => setBusquedaResidentes("")}
                >
                  ✕
                </button>
              )}
            </div>
            <div className="colab-conteo">
              Mostrando <strong>{residentesFiltrados.length}</strong> de {residentes.length} residentes
            </div>
          </div>

          <div className="colaboradores-grid">
            {residentesFiltrados.map((res, index) => (
              <div key={res.cedula || index} className="colaborador-card">
                <div className="colab-avatar">🏗️</div>
                <div className="colab-body">
                  <h4 className="colab-nombre">{res.nombre}</h4>
                  <span className="colab-cargo-badge">{res.cargo || "Residente de Obra"}</span>
                  <div className="colab-detalles-lista">
                    {res.cedula && (
                      <div className="colab-detalle-item">
                        <span className="detalle-etiqueta">Cédula:</span>
                        <span className="detalle-valor">{res.cedula}</span>
                      </div>
                    )}
                    {res.email && (
                      <div className="colab-detalle-item">
                        <span className="detalle-etiqueta">Correo:</span>
                        <span className="detalle-valor email-texto">✉️ {res.email}</span>
                      </div>
                    )}
                    {res.centro_nombre && (
                      <div className="colab-detalle-item">
                        <span className="detalle-etiqueta">Centro / Obra:</span>
                        <span className="detalle-valor">{res.centro_nombre}</span>
                      </div>
                    )}
                    {res.empresa && (
                      <div className="colab-detalle-item">
                        <span className="detalle-etiqueta">Empresa:</span>
                        <span className="detalle-valor">{res.empresa}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* PESTAÑA 3: DIRECTORES */}
      {/* ========================================== */}
      {tabActiva === "directores" && (
        <div className="colaboradores-tab-contenido">
          <div className="colab-busqueda-bar">
            <div className="input-busqueda-icono">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Buscar director por nombre, cédula, cargo o área..."
                value={busquedaDirectores}
                onChange={(e) => setBusquedaDirectores(e.target.value)}
              />
              {busquedaDirectores && (
                <button
                  className="btn-limpiar"
                  onClick={() => setBusquedaDirectores("")}
                >
                  ✕
                </button>
              )}
            </div>
            <div className="colab-conteo">
              Mostrando <strong>{directoresFiltrados.length}</strong> de {directores.length} directores
            </div>
          </div>

          <div className="colaboradores-grid">
            {directoresFiltrados.map((dir, index) => (
              <div key={dir.cedula || index} className="colaborador-card card-director">
                <div className="colab-avatar avatar-director">👔</div>
                <div className="colab-body">
                  <h4 className="colab-nombre">{dir.nombre}</h4>
                  <span className="colab-cargo-badge badge-director">
                    {dir.cargo || "Director"}
                  </span>
                  <div className="colab-detalles-lista">
                    {dir.cedula && (
                      <div className="colab-detalle-item">
                        <span className="detalle-etiqueta">Cédula:</span>
                        <span className="detalle-valor">{dir.cedula}</span>
                      </div>
                    )}
                    {dir.email && (
                      <div className="colab-detalle-item">
                        <span className="detalle-etiqueta">Correo:</span>
                        <span className="detalle-valor email-texto">✉️ {dir.email}</span>
                      </div>
                    )}
                    {dir.centro_nombre && (
                      <div className="colab-detalle-item">
                        <span className="detalle-etiqueta">Centro / Área:</span>
                        <span className="detalle-valor">{dir.centro_nombre}</span>
                      </div>
                    )}
                    {dir.empresa && (
                      <div className="colab-detalle-item">
                        <span className="detalle-etiqueta">Empresa:</span>
                        <span className="detalle-valor">{dir.empresa}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* PESTAÑA 4: TODOS LOS COLABORADORES */}
      {/* ========================================== */}
      {tabActiva === "todos" && (
        <div className="colaboradores-tab-contenido">
          <div className="colab-busqueda-bar">
            <div className="input-busqueda-icono">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Buscar colaborador por nombre, cédula o centro de costo..."
                value={busquedaTodos}
                onChange={(e) => setBusquedaTodos(e.target.value)}
              />
              {busquedaTodos && (
                <button
                  className="btn-limpiar"
                  onClick={() => setBusquedaTodos("")}
                >
                  ✕
                </button>
              )}
            </div>
            <div className="colab-conteo">
              Mostrando <strong>{todosFiltrados.length}</strong> de {todos.length} colaboradores
            </div>
          </div>

          <div className="colaboradores-tabla-card">
            <table className="tabla-colaboradores">
              <thead>
                <tr>
                  <th>Nombre Completo</th>
                  <th>Cédula</th>
                  <th>Cargo</th>
                  <th>Correo Corporativo</th>
                  <th>Centro / Obra</th>
                  <th>Empresa</th>
                </tr>
              </thead>
              <tbody>
                {todosFiltrados.slice(0, 100).map((c, idx) => (
                  <tr key={c.cedula || idx}>
                    <td className="td-nombre">
                      <strong>{c.nombre}</strong>
                    </td>
                    <td>{c.cedula || "-"}</td>
                    <td>
                      <span className="badge-cargo-tabla">{c.cargo || "No especificado"}</span>
                    </td>
                    <td>
                      {c.email ? <span className="email-texto">✉️ {c.email}</span> : "-"}
                    </td>
                    <td>{c.centro_nombre || c.centro_codigo || "-"}</td>
                    <td>{c.empresa || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {todosFiltrados.length > 100 && (
              <p className="tabla-pie-aviso">
                Mostrando los primeros 100 registros. Use el buscador para afinar la búsqueda.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: NUEVO FLUJO */}
      {/* ========================================== */}
      {modalNuevoFlujo && (
        <div className="modal-overlay" onClick={() => setModalNuevoFlujo(false)}>
          <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚡ Crear Nuevo Flujo de Aprobación</h3>
              <button
                className="btn-cerrar-modal"
                onClick={() => setModalNuevoFlujo(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCrearNuevoFlujo}>
              <div className="campo">
                <label>Nombre del Flujo *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Flujo para Residentes de Obra"
                  value={nuevoFlujoNombre}
                  onChange={(e) => setNuevoFlujoNombre(e.target.value)}
                />
              </div>

              <div className="campo">
                <label>Descripción / Propósito</label>
                <textarea
                  rows="3"
                  placeholder="Explique cuándo y para qué cargos aplica este flujo..."
                  value={nuevoFlujoDesc}
                  onChange={(e) => setNuevoFlujoDesc(e.target.value)}
                />
              </div>

              <div className="campo">
                <label className="checkbox-comodin-label modal-comodin">
                  <input
                    type="checkbox"
                    checked={nuevoAplicaOtros}
                    onChange={(e) => setNuevoAplicaOtros(e.target.checked)}
                  />
                  <span>Incluye a todos los cargos, menos los cargos que ya tienen flujo</span>
                </label>
              </div>

              <div className="modal-acciones">
                <button
                  type="button"
                  className="btn-cancelar"
                  onClick={() => setModalNuevoFlujo(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-guardar"
                  disabled={guardandoFlujo}
                >
                  {guardandoFlujo ? "Creando..." : "Crear Flujo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
