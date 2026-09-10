import { useEffect, useRef, useState } from "react";
import {
  buscarEmpleados,
  crearAnticipo,
  listarCentros,
  listarDirectores,
} from "./api";

const CAMPOS_INICIALES = {
  nombre: "",
  cedula: "",
  centro_costo: "",
  obra: "",
  valor: "",
  director_autoriza: "",
  justificacion: "",
};

export default function SolicitudForm({ onCreado }) {
  const [form, setForm] = useState(CAMPOS_INICIALES);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(false);

  const [centros, setCentros] = useState([]);
  const [directores, setDirectores] = useState([]);

  const [busquedaEmpleado, setBusquedaEmpleado] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [buscandoEmpleado, setBuscandoEmpleado] = useState(false);
  const contenedorBusquedaRef = useRef(null);

  useEffect(() => {
    listarCentros().then(setCentros).catch(() => setCentros([]));
    listarDirectores().then(setDirectores).catch(() => setDirectores([]));
  }, []);

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
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function seleccionarEmpleado(empleado) {
    setForm((prev) => ({
      ...prev,
      nombre: empleado.nombre,
      cedula: empleado.cedula,
      centro_costo: prev.centro_costo || empleado.centro_codigo || "",
      obra: prev.obra || empleado.centro_nombre || "",
    }));
    setBusquedaEmpleado(empleado.nombre);
    setMostrarSugerencias(false);
  }

  function handleCentroChange(e) {
    const codigo = e.target.value;
    const centro = centros.find((c) => c.codigo === codigo);
    setForm((prev) => ({
      ...prev,
      centro_costo: codigo,
      obra: centro?.nombre ?? "",
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    setExito(false);
    try {
      await crearAnticipo({ ...form, valor: Number(form.valor) });
      setForm(CAMPOS_INICIALES);
      setBusquedaEmpleado("");
      setExito(true);
      onCreado?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tarjeta-form">
      <form className="solicitud-form" onSubmit={handleSubmit}>
        <div className="campo campo-completo" ref={contenedorBusquedaRef}>
          <label htmlFor="busqueda_empleado">Buscar empleado</label>
          <div className="buscador">
            <input
              id="busqueda_empleado"
              placeholder="Escribe el nombre o la cédula del solicitante"
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
                      {emp.cedula} · {emp.cargo}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="campo">
          <label htmlFor="nombre">Nombre</label>
          <input
            id="nombre"
            name="nombre"
            placeholder="Nombre completo"
            value={form.nombre}
            onChange={handleChange}
            required
          />
        </div>

        <div className="campo">
          <label htmlFor="cedula">Cédula</label>
          <input
            id="cedula"
            name="cedula"
            placeholder="N.º de identificación"
            value={form.cedula}
            onChange={handleChange}
            required
          />
        </div>

        <div className="campo">
          <label htmlFor="obra">Obra</label>
          <select id="obra" value={form.centro_costo} onChange={handleCentroChange} required>
            <option value="" disabled>
              Selecciona la obra
            </option>
            {centros.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="centro_costo">Centro de costo</label>
          <input id="centro_costo" value={form.centro_costo} disabled readOnly />
        </div>

        <div className="campo">
          <label htmlFor="valor">Valor</label>
          <div className="input-prefijo">
            <span>$</span>
            <input
              id="valor"
              type="number"
              name="valor"
              min="0.01"
              step="0.01"
              placeholder="0"
              value={form.valor}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="campo">
          <label htmlFor="director_autoriza">Director que autoriza</label>
          <select
            id="director_autoriza"
            name="director_autoriza"
            value={form.director_autoriza}
            onChange={handleChange}
            required
          >
            <option value="" disabled>
              Selecciona un director
            </option>
            {directores.map((d) => (
              <option key={d.nombre} value={d.nombre}>
                {d.nombre} — {d.cargo}
              </option>
            ))}
          </select>
        </div>

        <div className="campo campo-completo">
          <label htmlFor="justificacion">¿Para qué se requiere el anticipo?</label>
          <textarea
            id="justificacion"
            name="justificacion"
            placeholder="Describe el motivo del anticipo"
            value={form.justificacion}
            onChange={handleChange}
            rows={4}
            required
          />
        </div>

        <div className="campo-completo acciones-form">
          {error && <p className="mensaje mensaje-error">{error}</p>}
          {exito && (
            <p className="mensaje mensaje-exito">Solicitud enviada correctamente.</p>
          )}
          <button type="submit" disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar solicitud"}
          </button>
        </div>
      </form>
    </div>
  );
}
