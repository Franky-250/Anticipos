import ListaAnticipos from "../ListaAnticipos";

export default function Estados() {
  return (
    <div>
      <div className="pagina-encabezado">
        <h2>Consulta de Solicitudes</h2>
        <p>Seguimiento y consulta del estado de cada solicitud de anticipo.</p>
      </div>
      <ListaAnticipos />
    </div>
  );
}
