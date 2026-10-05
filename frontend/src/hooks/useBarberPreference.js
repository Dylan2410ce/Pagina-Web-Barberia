import { useEffect, useState } from "react";

const CLAVE = "sebas-barber:barbero-preferido";

export function leerBarberoPreferido() {
  try { return localStorage.getItem(CLAVE) || ""; } catch { return ""; }
}

export default function useBarberPreference(barberos, seleccionado) {
  const [recordar, setRecordar] = useState(() => Boolean(leerBarberoPreferido()));
  useEffect(() => {
    try {
      if (recordar && barberos.some((item) => item.id === seleccionado)) localStorage.setItem(CLAVE, seleccionado);
      else if (!recordar || !barberos.some((item) => item.id === leerBarberoPreferido())) localStorage.removeItem(CLAVE);
    } catch { /* La reserva funciona también sin almacenamiento local. */ }
  }, [barberos, seleccionado, recordar]);
  return [recordar, setRecordar];
}
