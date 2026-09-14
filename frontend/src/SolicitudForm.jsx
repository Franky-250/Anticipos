import { useEffect, useRef, useState, useMemo } from "react";
import {
  buscarEmpleados,
  crearAnticipo,
  evaluarFlujoPorCargo,
  listarAutorizadores,
  listarCentros,
  obtenerConfiguracionTope,
} from "./api";
import SearchableSelect from "./components/SearchableSelect";
import SignaturePad from "./components/SignaturePad";

const EMPRESAS = ["PCMejia", "PCSolar", "Carsan Electric", "PCM"];

const CAMPOS_INICIALES = {
  nombre: "",
  cedula: "",
  cargo: "",
  empresa: "PCMejia",
  centro_costo: "",
  obra: "",
  valor: "",
  director_autoriza: "",
  motivo_tipo: "compras", // "compras" | "transporte"
  motivo_detalle: "",
  obra_destino: "",
  transporte_otro: false,
  firma: "",
  supera_tope: false,
  autorizador_tope_nombre: "",
  autorizador_tope_cargo: "",
  autorizador_tope_email: "",
};

const formatoMoneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function SolicitudForm({ onCreado }) {
  const [paso, setPaso] = useState(1);
  const [form, setForm] = useState(CAMPOS_INICIALES);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(false);

  const [centros, setCentros] = useState([]);
  const [autorizadores, setAutorizadores] = useState([]);
  const [flujoEvaluado, setFlujoEvaluado] = useState(null);
  const [configTope, setConfigTope] = useState(null);

  const [busquedaEmpleado, setBusquedaEmpleado] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [buscandoEmpleado, setBuscandoEmpleado] = useState(false);
  const contenedorBusquedaRef = useRef(null);

  useEffect(() => {
    listarCentros().then(setCentros).catch(() => setCentros([]));
    listarAutorizadores().then(setAutorizadores).catch(() => setAutorizadores([]));
    obtenerConfiguracionTope().then(setConfigTope).catch(() => setConfigTope(null));
  }, []);

  const montoTopeVal = configTope?.monto_tope ? Number(configTope.monto_tope) : 1500000;
  const topeActivo = configTope?.activo ?? true;
  const esSobretope = topeActivo && Number(form.valor) > montoTopeVal;

  const opcionesAutorizadoresSobretope = useMemo(() => {
    if (configTope?.autorizadores && configTope.autorizadores.length > 0) {
      return configTope.autorizadores.map((a) => ({
        codigo: a.nombre,
        nombre: a.nombre,
        cargo: a.cargo || "Autorizador Sobretope",
        email: a.email || "",
        objetoOriginal: a,
      }));
    }
    return autorizadores.map((a) => ({
      codigo: a.nombre,
      nombre: a.nombre,
      cargo: a.cargo || "",
      email: a.email || "",
      objetoOriginal: a,
    }));
  }, [configTope, autorizadores]);

  function handleAutorizadorSobretopeChange(nombreOValor) {
    const encontrado = opcionesAutorizadoresSobretope.find(
      (op) => op.codigo === nombreOValor || op.nombre === nombreOValor
    );
    setForm((prev) => ({
      ...prev,
      autorizador_tope_nombre: encontrado ? encontrado.nombre : nombreOValor,
      autorizador_tope_cargo: encontrado ? encontrado.cargo : "",
      autorizador_tope_email: encontrado ? encontrado.email : "",
    }));
  }

  useEffect(() => {
    if (form.cargo) {
      evaluarFlujoPorCargo(form.cargo)
        .then((fl) => setFlujoEvaluado(fl))
        .catch(() => setFlujoEvaluado(null));
    } else {
      setFlujoEvaluado(null);
    }
  }, [form.cargo]);

  useEffect(() => {
    function handleClickFuera(e) {

      if (!contenedorBusquedaRef.current?.contains(e.target)) {
        setMostrarSugerencias(false);
      }
    }
    document.addEventListener("mousedown", handleClickFuera);
    return () => document.removeEventListener("mousedown", handleClickFuera);
  }, []);

  useEffect(() => {
    const query = busquedaEmpleado.trim();
    if (query.length < 2) {
      setSugerencias([]);
      return;
    }
    setBuscandoEmpleado(true);
    const timeoutId = setTimeout(() => {
      buscarEmpleados(query)
        .then((resultados) => {
          setSugerencias(resultados);
          setMostrarSugerencias(true);
        })
        .catch(() => setSugerencias([]))
        .finally(() => setBuscandoEmpleado(false));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [busquedaEmpleado]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleValorChange(e) {
    const valorLimpio = e.target.value.replace(/\D/g, "");
    setForm((prev) => ({
      ...prev,
      valor: valorLimpio,
    }));
  }

  function seleccionarEmpleado(empleado) {
    setForm((prev) => ({
      ...prev,
      nombre: empleado.nombre || "",
      cedula: empleado.cedula || "",
      cargo: empleado.cargo || "",
      empresa:
        empleado.empresa && EMPRESAS.includes(empleado.empresa)
          ? empleado.empresa
          : prev.empresa || "PCMejia",
      centro_costo: empleado.centro_codigo || prev.centro_costo || "",
      obra: empleado.centro_nombre || prev.obra || "",
    }));
    setBusquedaEmpleado(empleado.nombre);
    setMostrarSugerencias(false);
  }

  function handleObraChange(codigo) {
    const centro = centros.find((c) => c.codigo === codigo);
    setForm((prev) => ({
      ...prev,
      centro_costo: codigo,
      obra: centro?.nombre ?? "",
    }));
  }

  function handleObraDestinoChange(codigo) {
    const centro = centros.find((c) => c.codigo === codigo);
    setForm((prev) => ({
      ...prev,
      obra_destino: centro ? `${centro.codigo} - ${centro.nombre}` : "",
    }));
  }

  function validarPaso1() {
    if (!form.nombre.trim()) return "Por favor ingresa el nombre del solicitante.";
    if (!form.cedula.trim()) return "Por favor ingresa la cédula del solicitante.";
    if (!form.obra || !form.centro_costo) return "Por favor selecciona la obra.";
    return null;
  }

  function validarPaso2() {
    if (!form.valor || Number(form.valor) <= 0) return "Por favor ingresa un valor válido de anticipo.";
    if (esSobretope && !form.autorizador_tope_nombre) {
      return `El monto supera el tope estándar (${formatoMoneda.format(montoTopeVal)}). Por favor selecciona a la persona que autorizará el sobretope.`;
    }
    if (!form.director_autoriza) return "Por favor selecciona la persona que autoriza.";
    if (form.motivo_tipo === "compras") {
      if (!form.motivo_detalle.trim()) return "Por favor detalla el motivo de las compras.";
    } else if (form.motivo_tipo === "transporte") {
      if (form.transporte_otro) {
        if (!form.motivo_detalle.trim()) return "Por favor describe el destino o justificación del transporte.";
      } else {
        if (!form.obra_destino) return "Por favor selecciona la obra destino del traslado o marca 'Otro'.";
      }
    }
    return null;
  }

  function siguientePaso() {
    setError(null);
    if (paso === 1) {
      const err = validarPaso1();
      if (err) {
        setError(err);
        return;
      }
      setPaso(2);
    } else if (paso === 2) {
      const err = validarPaso2();
      if (err) {
        setError(err);
        return;
      }
      setPaso(3);
    }
  }

  function anteriorPaso() {
    setError(null);
    setPaso((p) => Math.max(1, p - 1));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.firma) {
      setError("Es obligatorio adjuntar o dibujar la firma para autorizar la solicitud.");
      return;
    }

    setEnviando(true);
    setExito(false);

    try {
      const payload = {
        ...form,
        valor: Number(form.valor),
        supera_tope: esSobretope,
        monto_tope_aplicado: esSobretope ? montoTopeVal : 0,
        autorizador_tope_nombre: esSobretope ? form.autorizador_tope_nombre : "",
        autorizador_tope_cargo: esSobretope ? form.autorizador_tope_cargo : "",
        autorizador_tope_email: esSobretope ? form.autorizador_tope_email : "",
        justificacion:
          form.motivo_tipo === "compras"
            ? `Compras: ${form.motivo_detalle}`
            : `Transporte a: ${form.transporte_otro ? form.motivo_detalle : form.obra_destino}`,
      };

      await crearAnticipo(payload);
      setForm(CAMPOS_INICIALES);
      setBusquedaEmpleado("");
      setPaso(1);
      setExito(true);
      onCreado?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const obraDestinoCodigo = centros.find(
    (c) => `${c.codigo} - ${c.nombre}` === form.obra_destino
  )?.codigo || "";

  return (
    <div className="tarjeta-form">
      {/* Stepper / Indicador de Pasos */}
      <div className="wizard-stepper">
        <div className={`step-item ${paso >= 1 ? "activo" : ""} ${paso > 1 ? "completado" : ""}`}>
          <div className="step-circle">{paso > 1 ? "✓" : "1"}</div>
          <div className="step-content">
            <span className="step-titulo">Paso 1</span>
            <span className="step-subtitulo">Información General</span>
          </div>
        </div>
        <div className={`step-divider ${paso >= 2 ? "activo" : ""}`} />
        <div className={`step-item ${paso >= 2 ? "activo" : ""} ${paso > 2 ? "completado" : ""}`}>
          <div className="step-circle">{paso > 2 ? "✓" : "2"}</div>
          <div className="step-content">
            <span className="step-titulo">Paso 2</span>
            <span className="step-subtitulo">Detalle y Motivo</span>
          </div>
        </div>
        <div className={`step-divider ${paso >= 3 ? "activo" : ""}`} />
        <div className={`step-item ${paso === 3 ? "activo" : ""}`}>
          <div className="step-circle">3</div>
          <div className="step-content">
            <span className="step-titulo">Paso 3</span>
            <span className="step-subtitulo">Resumen y Firma</span>
          </div>
        </div>
      </div>

      {exito && (
        <div className="mensaje mensaje-exito" style={{ marginBottom: "1.5rem" }}>
          <strong>¡Solicitud enviada con éxito!</strong> Tu requerimiento de anticipo ha sido registrado correctamente.
        </div>
      )}

      {error && (
        <div className="mensaje mensaje-error" style={{ marginBottom: "1.5rem" }}>
          {error}
        </div>
      )}

      <form className="solicitud-form" onSubmit={handleSubmit}>
        {/* ===================== PASO 1 ===================== */}
        {paso === 1 && (
          <>
            <div className="campo campo-completo" ref={contenedorBusquedaRef}>
              <label htmlFor="busqueda_empleado">Buscar empleado (Cronos)</label>
              <div className="buscador">
                <input
                  id="busqueda_empleado"
                  placeholder="Escribe el nombre o cédula para autocompletar datos"
                  value={busquedaEmpleado}
                  onChange={(e) => setBusquedaEmpleado(e.target.value)}
                  onFocus={() => sugerencias.length > 0 && setMostrarSugerencias(true)}
                  autoComplete="off"
                />
                {buscandoEmpleado && <span className="buscador-spinner" />}
                {mostrarSugerencias && sugerencias.length > 0 && (
                  <ul className="sugerencias">
                    {sugerencias.map((emp) => (
                      <li key={emp.cedula} onClick={() => seleccionarEmpleado(emp)}>
                        <span className="sugerencia-nombre">{emp.nombre}</span>
                        <span className="sugerencia-detalle">
                          Cédula: {emp.cedula} · {emp.cargo || "Sin cargo"} {emp.empresa ? `· ${emp.empresa}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="campo">
              <label htmlFor="nombre">Nombre completo *</label>
              <input
                id="nombre"
                name="nombre"
                placeholder="Se autocompleta al buscar el empleado"
                value={form.nombre}
                readOnly
                className="input-readonly"
                required
              />
            </div>

            <div className="campo">
              <label htmlFor="cedula">Cédula de ciudadanía *</label>
              <input
                id="cedula"
                name="cedula"
                placeholder="Se autocompleta al buscar el empleado"
                value={form.cedula}
                readOnly
                className="input-readonly"
                required
              />
            </div>

            <div className="campo">
              <label htmlFor="cargo">Cargo</label>
              <input
                id="cargo"
                name="cargo"
                placeholder="Se autocompleta al buscar el empleado"
                value={form.cargo}
                readOnly
                className="input-readonly"
              />
            </div>

            <div className="campo">
              <label htmlFor="empresa">Empresa *</label>
              <select
                id="empresa"
                name="empresa"
                value={form.empresa}
                onChange={handleChange}
                required
              >
                {EMPRESAS.map((emp) => (
                  <option key={emp} value={emp}>
                    {emp}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo">
              <label htmlFor="obra">Obra (con buscador integrado) *</label>
              <SearchableSelect
                id="obra"
                options={centros}
                value={form.centro_costo}
                onChange={handleObraChange}
                placeholder="Selecciona la obra..."
                searchPlaceholder="Escribe para buscar obra o código..."
              />
            </div>

            <div className="campo">
              <label htmlFor="centro_costo">Centro de costo asignado</label>
              <input
                id="centro_costo"
                value={form.centro_costo ? `${form.centro_costo} - ${form.obra}` : ""}
                placeholder="Se autocompleta al seleccionar la obra"
                disabled
                readOnly
                className="input-readonly"
              />
            </div>

            {/* 
            {flujoEvaluado && (
              <div className="campo-completo flujo-evaluado-banner">
                <div className="flujo-evaluado-header">
                  <span className="flujo-evaluado-icono">⚡</span>
                  <div>
                    <strong>Flujo de Aprobación Asignado: {flujoEvaluado.nombre}</strong>
                    <p>Cadena evaluada automáticamente según tu cargo ({form.cargo || "General"}):</p>
                  </div>
                </div>
                <div className="flujo-evaluado-pasos">
                  {flujoEvaluado.pasos?.map((p, i) => {
                    const esDinamico = Boolean(
                      p.es_dinamico_solicitud ||
                      p.nombre_aprobador === "Persona seleccionada en la solicitud"
                    );
                    const nombreMostrar = esDinamico
                      ? (form.director_autoriza || "👤 Quien autoriza (Por seleccionar)")
                      : p.nombre_aprobador;

                    return (
                      <span
                        key={p.id || i}
                        className={`flujo-evaluado-paso-chip ${esDinamico ? "chip-dinamico" : ""}`}
                      >
                        <strong>Paso {p.orden}:</strong> {nombreMostrar}{" "}
                        {p.rol_nivel ? `(${p.rol_nivel})` : ""}
                      </span>
                    );
                  })}
                  {flujoEvaluado.notificar_a_nombre && (
                    <span className="flujo-evaluado-notif-chip">
                      🔔 Notificación Final: {flujoEvaluado.notificar_a_nombre}
                    </span>
                  )}
                </div>
              </div>
            )}
            */}

            <div className="campo-completo wizard-acciones">
              <button type="button" className="btn-siguiente" onClick={siguientePaso}>
                Continuar al Paso 2 →
              </button>
            </div>
          </>
        )}

        {/* ===================== PASO 2 ===================== */}
        {paso === 2 && (
          <>
            <div className="campo">
              <label htmlFor="valor">Valor del anticipo (COP) *</label>
              <div className="input-prefijo input-moneda">
                <span>$</span>
                <input
                  id="valor"
                  type="text"
                  name="valor"
                  placeholder="0"
                  value={form.valor ? Number(form.valor).toLocaleString("es-CO") : ""}
                  onChange={handleValorChange}
                  required
                />
              </div>
              {form.valor && Number(form.valor) > 0 && (
                <span className="valor-formateado-ayuda">
                  {formatoMoneda.format(Number(form.valor))}
                </span>
              )}
            </div>

            <div className="campo">
              <label htmlFor="director_autoriza">¿Quién autoriza? *</label>
              <SearchableSelect
                id="director_autoriza"
                options={autorizadores}
                value={form.director_autoriza}
                valueKey="nombre"
                labelKey="nombre"
                onChange={(personaNombre) =>
                  setForm((prev) => ({ ...prev, director_autoriza: personaNombre }))
                }
                placeholder="Selecciona la persona que autoriza..."
                searchPlaceholder="Buscar persona por nombre o cargo..."
              />
            </div>

            {esSobretope && (
              <div className="campo-completo alerta-sobretope-form">
                <div className="alerta-sobretope-header">
                  <span className="alerta-sobretope-icono">⚠️</span>
                  <div>
                    <strong>Solicitud de Sobretope Requerida</strong>
                    <p>
                      El monto solicitado ({formatoMoneda.format(Number(form.valor))}) supera el límite estándar permitido ({formatoMoneda.format(montoTopeVal)}).
                      Debes seleccionar a una persona facultada para autorizar el sobretope antes de continuar el flujo normal.
                    </p>
                  </div>
                </div>
                <div className="alerta-sobretope-selector">
                  <label htmlFor="autorizador_tope">
                    Persona que autoriza el sobretope *
                  </label>
                  <SearchableSelect
                    id="autorizador_tope"
                    options={opcionesAutorizadoresSobretope}
                    value={form.autorizador_tope_nombre}
                    valueKey="nombre"
                    labelKey="nombre"
                    onChange={handleAutorizadorSobretopeChange}
                    placeholder="Selecciona quién autorizará este sobretope..."
                    searchPlaceholder="Buscar por nombre o cargo..."
                  />
                </div>
              </div>
            )}

            <div className="campo campo-completo">
              <label htmlFor="motivo_tipo">Motivo del anticipo *</label>
              <div className="motivo-selector-grid">
                <label className={`motivo-opcion-card ${form.motivo_tipo === "compras" ? "activo" : ""}`}>
                  <input
                    type="radio"
                    name="motivo_tipo"
                    value="compras"
                    checked={form.motivo_tipo === "compras"}
                    onChange={handleChange}
                  />
                  <div className="motivo-card-icono">🛍️</div>
                  <div className="motivo-card-texto">
                    <strong>Compras</strong>
                    <span>Adquisición de materiales, insumos o suministros menores.</span>
                  </div>
                </label>

                <label className={`motivo-opcion-card ${form.motivo_tipo === "transporte" ? "activo" : ""}`}>
                  <input
                    type="radio"
                    name="motivo_tipo"
                    value="transporte"
                    checked={form.motivo_tipo === "transporte"}
                    onChange={handleChange}
                  />
                  <div className="motivo-card-icono">🚚</div>
                  <div className="motivo-card-texto">
                    <strong>Transporte</strong>
                    <span>Fletes, traslados de maquinaria, herramientas o personal.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Condicional para Compras */}
            {form.motivo_tipo === "compras" && (
              <div className="campo campo-completo">
                <label htmlFor="motivo_detalle">Motivo y detalle de las compras *</label>
                <textarea
                  id="motivo_detalle"
                  name="motivo_detalle"
                  placeholder="Describe qué materiales o compras se realizarán con este anticipo..."
                  value={form.motivo_detalle}
                  onChange={handleChange}
                  rows={3}
                  required
                />
              </div>
            )}

            {/* Condicional para Transporte */}
            {form.motivo_tipo === "transporte" && (
              <>
                {!form.transporte_otro ? (
                  <div className="campo campo-completo">
                    <label htmlFor="obra_destino">Trasladado a: (Obra destino) *</label>
                    <SearchableSelect
                      id="obra_destino"
                      options={centros}
                      value={obraDestinoCodigo}
                      onChange={handleObraDestinoChange}
                      placeholder="Busca y selecciona la obra de destino..."
                      searchPlaceholder="Buscar obra de destino..."
                    />
                  </div>
                ) : null}

                <div className="campo campo-completo" style={{ marginTop: "-0.25rem" }}>
                  <label className="checkbox-control">
                    <input
                      type="checkbox"
                      name="transporte_otro"
                      checked={form.transporte_otro}
                      onChange={handleChange}
                    />
                    <span>Otro (El traslado es hacia una ubicación o tercero no listado)</span>
                  </label>
                </div>

                {form.transporte_otro && (
                  <div className="campo campo-completo">
                    <label htmlFor="motivo_detalle">Justificación y detalle del traslado / destino *</label>
                    <textarea
                      id="motivo_detalle"
                      name="motivo_detalle"
                      placeholder="Especifica el destino, ruta o motivo del transporte..."
                      value={form.motivo_detalle}
                      onChange={handleChange}
                      rows={3}
                      required
                    />
                  </div>
                )}
              </>
            )}

            <div className="campo-completo wizard-acciones">
              <button type="button" className="btn-anterior" onClick={anteriorPaso}>
                ← Volver al Paso 1
              </button>
              <button type="button" className="btn-siguiente" onClick={siguientePaso}>
                Continuar al Resumen →
              </button>
            </div>
          </>
        )}

        {/* ===================== PASO 3 ===================== */}
        {paso === 3 && (
          <>
            <div className="campo-completo">
              <div className="resumen-card">
                <div className="resumen-encabezado">
                  <h3>Resumen de la Solicitud</h3>
                  <span className="badge-revision">Listo para autorización</span>
                </div>

                <div className="resumen-grid">
                  <div className="resumen-item">
                    <span className="resumen-label">Solicitante:</span>
                    <span className="resumen-valor">{form.nombre}</span>
                  </div>
                  <div className="resumen-item">
                    <span className="resumen-label">Cédula:</span>
                    <span className="resumen-valor">{form.cedula}</span>
                  </div>
                  {form.cargo && (
                    <div className="resumen-item">
                      <span className="resumen-label">Cargo:</span>
                      <span className="resumen-valor">{form.cargo}</span>
                    </div>
                  )}
                  {form.empresa && (
                    <div className="resumen-item">
                      <span className="resumen-label">Empresa:</span>
                      <span className="resumen-valor">{form.empresa}</span>
                    </div>
                  )}
                  <div className="resumen-item">
                    <span className="resumen-label">Obra origen:</span>
                    <span className="resumen-valor">{form.obra}</span>
                  </div>
                  <div className="resumen-item">
                    <span className="resumen-label">Centro de costo:</span>
                    <span className="resumen-valor">{form.centro_costo}</span>
                  </div>
                  <div className="resumen-item">
                    <span className="resumen-label">Quién autoriza:</span>
                    <span className="resumen-valor">{form.director_autoriza}</span>
                  </div>
                  <div className="resumen-item resumen-item-destacado">
                    <span className="resumen-label">Valor del anticipo:</span>
                    <span className="resumen-valor valor-destacado">
                      {formatoMoneda.format(Number(form.valor))}
                    </span>
                  </div>
                  {esSobretope && (
                    <div className="resumen-item resumen-item-alerta">
                      <span className="resumen-label">⚠️ Autorización de Sobretope:</span>
                      <span className="resumen-valor" style={{ color: "#d97706", fontWeight: 700 }}>
                        {form.autorizador_tope_nombre} {form.autorizador_tope_cargo ? `(${form.autorizador_tope_cargo})` : ""}
                      </span>
                    </div>
                  )}
                  <div className="resumen-item">
                    <span className="resumen-label">Tipo de motivo:</span>
                    <span className="resumen-valor">
                      {form.motivo_tipo === "compras" ? "🛍️ Compras" : "🚚 Transporte"}
                    </span>
                  </div>
                  <div className="resumen-item resumen-item-completo">
                    <span className="resumen-label">
                      {form.motivo_tipo === "compras"
                        ? "Detalle de compras:"
                        : form.transporte_otro
                        ? "Destino especial / justificación:"
                        : "Obra destino:"}
                    </span>
                    <span className="resumen-valor">
                      {form.motivo_tipo === "compras"
                        ? form.motivo_detalle
                        : form.transporte_otro
                        ? form.motivo_detalle
                        : form.obra_destino}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Módulo de Firma */}
            <div className="campo campo-completo">
              <label>Firma del Solicitante / Autorización *</label>
              <p className="campo-subtexto">
                Por favor firma en el cuadro inferior o sube una imagen de tu firma manuscrita.
              </p>
              <SignaturePad
                value={form.firma}
                onChange={(firmaData) => setForm((prev) => ({ ...prev, firma: firmaData }))}
              />
            </div>

            <div className="campo-completo wizard-acciones">
              <button type="button" className="btn-anterior" onClick={anteriorPaso} disabled={enviando}>
                ← Modificar Datos
              </button>
              <button type="submit" className="btn-enviar" disabled={enviando}>
                {enviando ? "Enviando solicitud..." : "Confirmar y Enviar Solicitud ✓"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
