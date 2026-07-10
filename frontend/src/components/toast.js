let contenedor;

function asegurarContenedor() {
  if (contenedor) return contenedor;
  contenedor = document.createElement("div");
  contenedor.className = "toast-stack";
  document.body.appendChild(contenedor);
  return contenedor;
}

export function toast(tipo, titulo, mensaje = "") {
  const nodo = document.createElement("article");
  nodo.className = `toast toast-${tipo}`;
  nodo.innerHTML = `
    <strong>${titulo}</strong>
    ${mensaje ? `<span>${mensaje}</span>` : ""}
    <button type="button" aria-label="Cerrar">×</button>
  `;
  nodo.querySelector("button").addEventListener("click", () => nodo.remove());
  asegurarContenedor().appendChild(nodo);
  setTimeout(() => nodo.remove(), tipo === "error" ? 6200 : 4300);
}

export function mostrarCarga(texto = "Procesando...") {
  let capa = document.querySelector("[data-loader-global]");
  if (!capa) {
    capa = document.createElement("div");
    capa.dataset.loaderGlobal = "true";
    capa.className = "loader-global";
    document.body.appendChild(capa);
  }
  capa.innerHTML = `<div class="spinner grande"></div><p>${texto}</p>`;
  capa.hidden = false;
}

export function ocultarCarga() {
  const capa = document.querySelector("[data-loader-global]");
  if (capa) capa.hidden = true;
}
