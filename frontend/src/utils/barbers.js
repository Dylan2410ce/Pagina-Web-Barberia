function instagramSeguro(enlace) {
  try {
    const url = new URL(enlace);
    return url.protocol === "https:" && !url.username && !url.password
      && ["instagram.com", "www.instagram.com"].includes(url.hostname) ? enlace : null;
  } catch { return null; }
}

export function normalizarBarberos(barberos = []) {
  return barberos.map((barbero) => ({ ...barbero, instagram_url: instagramSeguro(barbero.instagram_url) }));
}
