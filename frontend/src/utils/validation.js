export const validarNombre = (valor) => valor.trim().length < 3
  ? "Escribe tu nombre (al menos 3 caracteres)." : "";

export const validarTelefono = (valor) => /^[24678]\d{7}$/.test(valor)
  ? "" : "Usa un teléfono de Costa Rica de 8 dígitos, sin +506.";

export const normalizarBusqueda = (valor) => String(valor ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CR").trim();

export const coincideBusqueda = (valores, consulta) => normalizarBusqueda(valores.join(" "))
  .includes(normalizarBusqueda(consulta));
