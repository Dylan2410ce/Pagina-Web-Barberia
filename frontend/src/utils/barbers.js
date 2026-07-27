export const SEBASTIAN_INSTAGRAM_URL = "https://www.instagram.com/__andres29__/";

function esSebastian(barbero = {}) {
  return String(barbero.name || "")
    .toLocaleLowerCase("es-CR")
    .startsWith("sebas");
}

export function normalizarBarberos(barberos = []) {
  return barberos.map((barbero) => (
    esSebastian(barbero)
      ? { ...barbero, instagram_url: SEBASTIAN_INSTAGRAM_URL }
      : barbero
  ));
}
