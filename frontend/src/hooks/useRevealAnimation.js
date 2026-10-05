import { useEffect } from "react";

export default function useRevealAnimation() {
  useEffect(() => {
    const reducida = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observados = new WeakSet();
    const observador = !reducida && "IntersectionObserver" in window ? new IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        entrada.target.classList.add("visible");
        observador.unobserve(entrada.target);
      });
    }, { threshold: .08 }) : null;
    const registrar = (elemento) => {
      if (observados.has(elemento)) return;
      observados.add(elemento);
      if (observador) {
        elemento.setAttribute("data-animate", "true");
        observador.observe(elemento);
      } else elemento.classList.add("visible");
    };
    const revisar = (nodo) => {
      if (nodo.nodeType !== 1) return;
      if (nodo.matches(".reveal")) registrar(nodo);
      nodo.querySelectorAll(".reveal").forEach(registrar);
    };
    revisar(document.body);
    const cambios = new MutationObserver((registros) => registros.forEach((registro) => registro.addedNodes.forEach(revisar)));
    cambios.observe(document.body, { childList: true, subtree: true });
    return () => { cambios.disconnect(); observador?.disconnect(); };
  }, []);
}
