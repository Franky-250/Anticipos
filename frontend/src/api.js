const API_URL = "http://localhost:8000/api";

export async function crearAnticipo(datos) {
  const res = await fetch(`${API_URL}/anticipos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.detail ?? "No se pudo crear el anticipo");
  }
  return res.json();
}

export async function listarAnticipos() {
  const res = await fetch(`${API_URL}/anticipos`);
  if (!res.ok) throw new Error("No se pudo obtener la lista de anticipos");
  return res.json();
}

export async function buscarEmpleados(q) {
  const res = await fetch(`${API_URL}/maestras/empleados?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("No se pudo buscar empleados");
  return res.json();
}

export async function listarDirectores() {
  const res = await fetch(`${API_URL}/maestras/directores`);
  if (!res.ok) throw new Error("No se pudo obtener la lista de directores");
  return res.json();
}

export async function listarCentros() {
  const res = await fetch(`${API_URL}/maestras/centros`);
  if (!res.ok) throw new Error("No se pudo obtener la lista de centros de costo");
  return res.json();
}
