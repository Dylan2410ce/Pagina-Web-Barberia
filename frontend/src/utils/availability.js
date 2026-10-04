export function sumarDias(fecha, dias) {
  const valor = new Date(`${fecha}T12:00:00Z`);
  valor.setUTCDate(valor.getUTCDate() + dias);
  return valor.toISOString().slice(0, 10);
}

export function horarioDelDia(horarios, fecha) {
  if (!fecha) return undefined;
  const dia = (new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7;
  return horarios.find((item) => item.weekday === dia);
}

export function siguienteDiaAbierto(horarios, fecha, limite) {
  for (let dias = 1; dias <= 7; dias += 1) {
    const siguiente = sumarDias(fecha, dias);
    if (limite && siguiente > limite) return null;
    if (horarioDelDia(horarios, siguiente)?.is_open !== false) return siguiente;
  }
  return null;
}
