export function abrirModal({ titulo, contenido, clase = "", alMontar }) {
  cerrarModal();
  const modal = document.createElement("section");
  modal.className = `modal-backdrop ${clase}`;
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${titulo}">
      <header>
        <strong>${titulo}</strong>
        <button type="button" class="icon-btn" data-cerrar-modal aria-label="Cerrar">×</button>
      </header>
      <div class="modal-body">${contenido}</div>
    </div>
  `;
  modal.addEventListener("click", (evento) => {
    if (evento.target === modal || evento.target.closest("[data-cerrar-modal]")) {
      cerrarModal();
    }
  });
  document.body.appendChild(modal);
  alMontar?.(modal);
  return modal;
}

export function cerrarModal() {
  document.querySelector(".modal-backdrop")?.remove();
}
