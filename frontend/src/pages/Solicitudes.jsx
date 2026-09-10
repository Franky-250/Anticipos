import SolicitudForm from "../SolicitudForm";

export default function Solicitudes() {
  return (
    <div>
      <div className="pagina-encabezado">
        <h2>Nueva solicitud</h2>
        <p>Completa los datos para solicitar un anticipo de obra.</p>
      </div>
      <SolicitudForm />
    </div>
  );
}
