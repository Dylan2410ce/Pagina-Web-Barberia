export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    }).catch((error) => {
      console.warn("No se pudo activar el modo instalable.", error);
    });
  });
}
