(function () {
  var preferencia = "system";
  try { preferencia = localStorage.getItem("sebas_apariencia") || "system"; } catch (_) { /* Almacenamiento privado no disponible. */ }
  if (!["system", "light", "dark"].includes(preferencia)) preferencia = "system";
  var oscuro = preferencia === "dark" || (preferencia === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = oscuro ? "dark" : "light";
})();
