import { useEffect, useState } from "react";
import { listarAnticipos } from "./api";

const formatoMoneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const ETIQUETAS_ESTADO = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

export default function ListaAnticipos({ reloadKey }) {
  const [anticipos, setAnticipos] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    listarAnticipos()
      .then(setAnticipos)
      .catch((err) => setError(err.message));
  }, [reloadKey]);

  if (error) return <p className="mensaje mensaje-error">{error}</p>;

  return (
    <div className="lista-anticipos">
      {anticipos.length === 0 ? (
        <div className="estado-vacio">
          <p>No hay solicitudes registradas.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Obra</th>
              <th>Centro de costo</th>
              <th>Valor</th>
              <th>Director</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {anticipos.map((a) => (
              <tr key={a.id}>
                <td>{a.nombre}</td>
                <td>{a.obra}</td>
                <td>{a.centro_costo}</td>
                <td>{formatoMoneda.format(a.valor)}</td>
                <td>{a.director_autoriza}</td>
                <td>
                  <span className={`estado estado-${a.estado}`}>
                    {ETIQUETAS_ESTADO[a.estado]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
