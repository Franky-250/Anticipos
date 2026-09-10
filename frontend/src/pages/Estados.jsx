import ListaAnticipos from "../ListaAnticipos";

export default function Estados() {
  return (
    <div>
      <div className="pagina-encabezado">
        <h2>Estados</h2>
        <p>Seguimiento del estado de cada solicitud de anticipo.</p>
      </div>
      <ListaAnticipos />
    </div>
  );
}
