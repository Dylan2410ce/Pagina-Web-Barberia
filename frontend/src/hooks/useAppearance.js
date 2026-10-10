import { useSyncExternalStore } from "react";

const CLAVE = "sebas_apariencia";
const EVENTO = "sebas:apariencia";
const OPCIONES = new Set(["system", "light", "dark"]);

export function leerApariencia() {
  try {
    const valor = localStorage.getItem(CLAVE);
    return OPCIONES.has(valor) ? valor : "system";
  } catch { return "system"; }
}

export function aplicarApariencia(preferencia = leerApariencia()) {
  const oscuro = preferencia === "dark" || (preferencia === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = oscuro ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", oscuro ? "#1c2021" : "#eaecea");
}

function suscribir(notificar) {
  const sistema = window.matchMedia("(prefers-color-scheme: dark)");
  const actualizar = () => { aplicarApariencia(); notificar(); };
  window.addEventListener(EVENTO, actualizar);
  window.addEventListener("storage", actualizar);
  sistema.addEventListener("change", actualizar);
  aplicarApariencia();
  return () => {
    window.removeEventListener(EVENTO, actualizar);
    window.removeEventListener("storage", actualizar);
    sistema.removeEventListener("change", actualizar);
  };
}

export default function useAppearance() {
  const preferencia = useSyncExternalStore(suscribir, leerApariencia, () => "system");
  const cambiar = (valor) => {
    if (!OPCIONES.has(valor)) return;
    try { localStorage.setItem(CLAVE, valor); } catch { /* La elección se aplica a la vista actual. */ }
    aplicarApariencia(valor);
    window.dispatchEvent(new Event(EVENTO));
  };
  return [preferencia, cambiar];
}
