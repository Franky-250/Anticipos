const API_URL = "http://localhost:8037/api";

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

export async function eliminarAnticipo(id) {
  const res = await fetch(`${API_URL}/anticipos/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.detail ?? "No se pudo eliminar la solicitud");
  }
  return res.json();
}

export async function legalizarAnticipo(id, datos) {
  const res = await fetch(`${API_URL}/anticipos/${id}/legalizar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.detail ?? "No se pudo registrar la legalización del anticipo");
  }
  return res.json();
}

export async function buscarEmpleados(q) {
  const res = await fetch(`${API_URL}/maestras/empleados?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("No se pudo buscar empleados");
  return res.json();
}

export async function listarAutorizadores() {
  let res = await fetch(`${API_URL}/maestras/autorizadores`);
  if (!res.ok && res.status === 404) {
    res = await fetch(`${API_URL}/maestras/directores`);
  }
  if (!res.ok) throw new Error("No se pudo obtener la lista de autorizadores");
  return res.json();
}

export const listarDirectores = listarAutorizadores;

export async function listarCentros() {
  const res = await fetch(`${API_URL}/maestras/centros`);
  if (!res.ok) throw new Error("No se pudo obtener la lista de centros de costo");
  return res.json();
}

export async function obtenerColaboradoresSegmentados() {
  const res = await fetch(`${API_URL}/colaboradores/segmentados`);
  if (!res.ok) throw new Error("No se pudo obtener la segmentación de colaboradores");
  return res.json();
}

export async function listarFlujosAprobacion() {
  const res = await fetch(`${API_URL}/flujos-aprobacion`);
  if (!res.ok) throw new Error("No se pudo obtener los flujos de aprobación");
  return res.json();
}

export async function obtenerFlujoAprobacion(id) {
  const res = await fetch(`${API_URL}/flujos-aprobacion/${id}`);
  if (!res.ok) throw new Error("No se pudo obtener el detalle del flujo");
  return res.json();
}

export async function crearFlujoAprobacion(datos) {
  const res = await fetch(`${API_URL}/flujos-aprobacion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.detail ?? "No se pudo crear el flujo de aprobación");
  }
  return res.json();
}

export async function actualizarFlujoAprobacion(id, datos) {
  const res = await fetch(`${API_URL}/flujos-aprobacion/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.detail ?? "No se pudo actualizar el flujo de aprobación");
  }
  return res.json();
}

export async function eliminarFlujoAprobacion(id) {
  const res = await fetch(`${API_URL}/flujos-aprobacion/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("No se pudo eliminar el flujo de aprobación");
  return true;
}

export async function listarCargos() {
  const res = await fetch(`${API_URL}/maestras/cargos`);
  if (!res.ok) throw new Error("No se pudo obtener la lista de cargos");
  return res.json();
}

export async function evaluarFlujoPorCargo(cargo) {
  if (!cargo) return null;
  const res = await fetch(`${API_URL}/flujos-aprobacion/evaluar-por-cargo?cargo=${encodeURIComponent(cargo)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function aprobarPasoAnticipo(anticipoId, datos = {}) {
  const res = await fetch(`${API_URL}/anticipos/${anticipoId}/aprobar-paso`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.detail ?? "No se pudo aprobar el paso del anticipo");
  }
  return res.json();
}

export async function rechazarPasoAnticipo(anticipoId, datos = {}) {
  const res = await fetch(`${API_URL}/anticipos/${anticipoId}/rechazar-paso`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.detail ?? "No se pudo rechazar el anticipo");
  }
  return res.json();
}

export async function obtenerPasosAnticipo(anticipoId) {
  const res = await fetch(`${API_URL}/anticipos/${anticipoId}/pasos`);
  if (!res.ok) throw new Error("No se pudieron obtener los pasos del anticipo");
  return res.json();
}

export async function verificarTokenSSO(token) {
  const res = await fetch(`${API_URL}/auth/verify-sso`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.detail ?? "Sesión SSO no válida");
  }
  return res.json();
}

// ==========================================
// GESTIÓN DE ACCESOS Y ROLES
// ==========================================

export async function listarCatalogoRoles() {
  const res = await fetch(`${API_URL}/accesos/roles`);
  if (!res.ok) throw new Error("No se pudo obtener el catálogo de roles");
  return res.json();
}

export async function listarUsuariosRoles(q = "", rol = "") {
  const params = new URLSearchParams();
  if (q) params.append("q", q);
  if (rol) params.append("rol", rol);
  const url = `${API_URL}/accesos/usuarios?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo obtener la lista de usuarios con roles");
  return res.json();
}

export async function asignarRolUsuario(datos) {
  const res = await fetch(`${API_URL}/accesos/usuarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.detail ?? "No se pudo asignar el rol al usuario");
  }
  return res.json();
}

export async function actualizarRolUsuario(usuarioId, datos) {
  const res = await fetch(`${API_URL}/accesos/usuarios/${usuarioId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.detail ?? "No se pudo actualizar el rol del usuario");
  }
  return res.json();
}

export async function eliminarRolUsuario(usuarioId) {
  const res = await fetch(`${API_URL}/accesos/usuarios/${usuarioId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.detail ?? "No se pudo eliminar el rol del usuario");
  }
  return res.json();
}

// ==========================================
// CONFIGURACIÓN DE TOPES Y SOBRETOPE
// ==========================================

export async function obtenerConfiguracionTope() {
  const res = await fetch(`${API_URL}/topes/configuracion`);
  if (!res.ok) throw new Error("No se pudo obtener la configuración de topes");
  return res.json();
}

export async function actualizarConfiguracionTope(datos) {
  const res = await fetch(`${API_URL}/topes/configuracion`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.detail ?? "No se pudo actualizar la configuración de topes");
  }
  return res.json();
}

export async function aprobarSobretopeAnticipo(anticipoId, datos = {}) {
  const res = await fetch(`${API_URL}/anticipos/${anticipoId}/aprobar-sobretope`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.detail ?? "No se pudo autorizar el sobretope del anticipo");
  }
  return res.json();
}

export async function rechazarSobretopeAnticipo(anticipoId, datos = {}) {
  const res = await fetch(`${API_URL}/anticipos/${anticipoId}/rechazar-sobretope`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.detail ?? "No se pudo rechazar el sobretope del anticipo");
  }
  return res.json();
}


