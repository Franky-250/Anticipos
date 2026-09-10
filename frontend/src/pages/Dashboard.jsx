import { useEffect, useState } from "react";
import { listarAnticipos } from "../api";

const formatoMoneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function Dashboard() {
  const [anticipos, setAnticipos] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    listarAnticipos()
      .then(setAnticipos)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="mensaje mensaje-error">{error}</p>;

  const total = anticipos.length;
  const pendientes = anticipos.filter((a) => a.estado === "pendiente").length;
  const aprobados = anticipos.filter((a) => a.estado === "aprobado").length;
  const rechazados = anticipos.filter((a) => a.estado === "rechazado").length;
  const valorTotal = anticipos.reduce((acc, a) => acc + Number(a.valor), 0);

  const tarjetas = [
    { titulo: "Total solicitudes", valor: total, tono: "azul" },
    { titulo: "Pendientes", valor: pendientes, tono: "amarillo" },
    { titulo: "Aprobados", valor: aprobados, tono: "verde" },
    { titulo: "Rechazados", valor: rechazados, tono: "rojo" },
    {
      titulo: "Valor total solicitado",
      valor: formatoMoneda.format(valorTotal),
      tono: "morado",
      ancho: true,
    },
  ];

  return (
    <div className="dashboard">
      <div className="pagina-encabezado">
        <h2>Dashboard</h2>
        <p>Resumen general de las solicitudes de anticipo.</p>
      </div>
      <div className="tarjetas">
        {tarjetas.map((t) => (
          <div
            className={`tarjeta tarjeta-${t.tono} ${t.ancho ? "tarjeta-ancha" : ""}`}
            key={t.titulo}
          >
            <span className="tarjeta-titulo">{t.titulo}</span>
            <span className="tarjeta-valor">{t.valor}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
