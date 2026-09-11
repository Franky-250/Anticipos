import { useEffect, useRef, useState } from "react";

export default function SearchableSelect(props) {
  const {
    options = props.opciones || [],
    value = props.valor || "",
    onChange = props.alCambiar,
    placeholder = "Seleccionar...",
    searchPlaceholder = "Buscar...",
    disabled = false,
    id,
    valueKey = "codigo",
    labelKey = "nombre",
  } = props;

  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const dropdownRef = useRef(null);
  const inputBusquedaRef = useRef(null);

  function getOptionValue(op) {
    if (typeof op === "string") return op;
    if (op[valueKey] !== undefined) return op[valueKey];
    return op.codigo || op.nombre || "";
  }

  function getOptionDisplay(op) {
    if (!op) return "";
    if (typeof op === "string") return op;
    if (op.cargo && op.nombre) return `${op.nombre} · ${op.cargo}`;
    if (op.codigo && op.nombre) return `${op.codigo} - ${op.nombre}`;
    return op[labelKey] || op.nombre || op.codigo || "";
  }

  const opcionSeleccionada = options.find((op) => getOptionValue(op) === value || op.nombre === value);

  useEffect(() => {
    function handleClickFuera(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", handleClickFuera);
    return () => document.removeEventListener("mousedown", handleClickFuera);
  }, []);

  useEffect(() => {
    if (abierto && inputBusquedaRef.current) {
      inputBusquedaRef.current.focus();
    }
    if (!abierto) {
      setBusqueda("");
    }
  }, [abierto]);

  const opcionesFiltradas = options.filter((op) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    if (typeof op === "string") return op.toLowerCase().includes(q);
    const nombre = (op.nombre || "").toLowerCase();
    const codigo = (op.codigo || "").toLowerCase();
    const cargo = (op.cargo || "").toLowerCase();
    const centro = (op.centro || op.centro_nombre || "").toLowerCase();
    return nombre.includes(q) || codigo.includes(q) || cargo.includes(q) || centro.includes(q);
  });

  function handleSelect(op) {
    const val = getOptionValue(op);
    if (onChange) onChange(val, op);
    setAbierto(false);
  }


  return (
    <div className={`searchable-select ${disabled ? "deshabilitado" : ""}`} ref={dropdownRef} id={id}>
      <button
        type="button"
        className={`searchable-select-trigger ${abierto ? "abierto" : ""} ${!opcionSeleccionada ? "placeholder" : ""}`}
        onClick={() => !disabled && setAbierto(!abierto)}
        disabled={disabled}
      >
        <span className="searchable-select-texto">
          {opcionSeleccionada ? getOptionDisplay(opcionSeleccionada) : placeholder}
        </span>
        <svg
          className={`searchable-select-chevron ${abierto ? "rotado" : ""}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {abierto && (
        <div className="searchable-select-menu">
          <div className="searchable-select-buscador">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              ref={inputBusquedaRef}
              type="text"
              placeholder={searchPlaceholder}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            {busqueda && (
              <button
                type="button"
                className="btn-limpiar-busqueda"
                onClick={() => setBusqueda("")}
              >
                ×
              </button>
            )}
          </div>
          <ul className="searchable-select-lista">
            {opcionesFiltradas.length > 0 ? (
              opcionesFiltradas.map((op, index) => {
                const opVal = getOptionValue(op);
                const isSelected = opVal === value;
                return (
                  <li
                    key={op.codigo || op.nombre || index}
                    className={`searchable-select-item ${isSelected ? "seleccionado" : ""}`}
                    onClick={() => handleSelect(op)}
                  >
                    {op.codigo ? <span className="item-codigo">{op.codigo}</span> : null}
                    <span className="item-nombre">{op.nombre}</span>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "2px" }}>
                      {op.cargo ? <span className="item-cargo" style={{ fontSize: "0.78rem", color: "#64748b" }}>💼 {op.cargo}</span> : null}
                      {op.email ? <span className="item-email" style={{ fontSize: "0.76rem", color: "#0284c7" }}>✉️ {op.email}</span> : null}
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="searchable-select-vacio">No se encontraron resultados</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
