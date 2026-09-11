import { useEffect, useRef, useState } from "react";

export default function SignaturePad({ value, onChange }) {
  const [modo, setModo] = useState("dibujar"); // "dibujar" | "subir"
  const canvasRef = useRef(null);
  const [dibujando, setDibujando] = useState(false);
  const [tieneTrazo, setTieneTrazo] = useState(false);
  const fileInputRef = useRef(null);

  // Inicializar canvas
  useEffect(() => {
    if (modo === "dibujar" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      // Ajustar resolución interna al tamaño en pantalla para nitidez
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.scale(ratio, ratio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#1e293b";

      // Si ya existía un valor en base64 dibujado previamente
      if (value && value.startsWith("data:image")) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          setTieneTrazo(true);
        };
        img.src = value;
      }
    }
  }, [modo]);

  function getPosicion(e) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function empezarDibujo(e) {
    if (e.cancelable && e.type.startsWith("touch")) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { x, y } = getPosicion(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDibujando(true);
    setTieneTrazo(true);
  }

  function dibujar(e) {
    if (!dibujando) return;
    if (e.cancelable && e.type.startsWith("touch")) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { x, y } = getPosicion(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function terminarDibujo() {
    if (!dibujando) return;
    setDibujando(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png");
      onChange(dataUrl);
    }
  }

  function limpiarCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setTieneTrazo(false);
    onChange("");
  }

  function handleSubirArchivo(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    if (!archivo.type.startsWith("image/")) {
      alert("Por favor selecciona un archivo de imagen válido (PNG, JPG, etc.)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      onChange(dataUrl);
    };
    reader.readAsDataURL(archivo);
  }

  function handleBorrarArchivo() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onChange("");
  }

  return (
    <div className="signature-container">
      <div className="signature-tabs">
        <button
          type="button"
          className={`signature-tab ${modo === "dibujar" ? "activo" : ""}`}
          onClick={() => setModo("dibujar")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          Dibujar Firma
        </button>
        <button
          type="button"
          className={`signature-tab ${modo === "subir" ? "activo" : ""}`}
          onClick={() => setModo("subir")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Subir Imagen
        </button>
      </div>

      {modo === "dibujar" ? (
        <div className="signature-canvas-wrapper">
          <canvas
            ref={canvasRef}
            className="signature-canvas"
            onMouseDown={empezarDibujo}
            onMouseMove={dibujar}
            onMouseUp={terminarDibujo}
            onMouseLeave={terminarDibujo}
            onTouchStart={empezarDibujo}
            onTouchMove={dibujar}
            onTouchEnd={terminarDibujo}
          />
          <div className="signature-footer">
            <span className="signature-hint">Dibuja tu firma con el dedo o el ratón</span>
            <button
              type="button"
              className="signature-btn-limpiar"
              onClick={limpiarCanvas}
              disabled={!tieneTrazo && !value}
            >
              Borrar trazo
            </button>
          </div>
        </div>
      ) : (
        <div className="signature-upload-wrapper">
          {value ? (
            <div className="signature-preview-box">
              <img src={value} alt="Firma cargada" className="signature-preview-img" />
              <button
                type="button"
                className="signature-btn-limpiar"
                onClick={handleBorrarArchivo}
              >
                Cambiar imagen
              </button>
            </div>
          ) : (
            <label className="signature-dropzone">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleSubirArchivo}
                style={{ display: "none" }}
              />
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <span>Haz clic o arrastra aquí la imagen de tu firma</span>
              <span className="signature-dropzone-tip">Formatos soportados: PNG, JPG (fondo blanco o transparente)</span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
