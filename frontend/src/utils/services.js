const PREMIUM_SERVICE_NAME = "Corte Premium";

export function nombreServicioPublico(servicio = {}) {
  const nombre = String(servicio.name || "").trim();
  const clave = nombre.toLocaleLowerCase("es-CR");
  const esCorteDeSebastian = Number(servicio.price) === 6000
    && clave.startsWith("corte")
    && clave.includes("sebasti");

  return esCorteDeSebastian ? PREMIUM_SERVICE_NAME : nombre;
}

export function normalizarServicios(servicios = []) {
  return servicios.map((servicio) => ({
    ...servicio,
    name: nombreServicioPublico(servicio),
  }));
}
