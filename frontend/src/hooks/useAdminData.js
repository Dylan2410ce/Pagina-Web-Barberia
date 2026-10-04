import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, borrarToken, obtenerToken } from "../api/client";
import { hoyISO, mesActual } from "../utils/format";

export const adminBase = {
  token: "", perfil: null, dashboard: null, citas: [], bloqueos: [], servicios: [],
  horarios: [], ausencias: [], clientes: [], actividad: [], listaEspera: [],
  reseñas: [], galeria: [], stats: null, operaciones: null,
  tab: "resumen", filtros: { date: hoyISO(), status: "", q: "" },
  errores: {}, actualizados: {}, cargas: {},
};

const recursos = {
  resumen: ["dashboard", "citas"], agenda: ["citas"], bloqueos: ["bloqueos", "ausencias"],
  servicios: ["servicios"], horarios: ["horarios"], clientes: ["clientes"],
  espera: ["listaEspera"], resenas: ["reseñas"], galeria: ["galeria"],
  reportes: ["stats"], operacion: ["operaciones", "servicios"], actividad: ["actividad"], seguridad: [],
};
export const recursosDeSeccion = (tab) => recursos[tab] || [];

const consultar = (clave, token, filtros) => {
  if (clave === "citas") return adminApi.citas(token, Object.fromEntries(Object.entries(filtros).filter(([, valor]) => valor !== "")));
  if (clave === "stats") { const { year, month } = mesActual(); return adminApi.stats(token, year, month); }
  return adminApi[clave](token);
};

export default function useAdminData(avisar) {
  const notificar = useRef(avisar);
  notificar.current = avisar;
  const [admin, setAdmin] = useState(() => ({ ...adminBase, token: obtenerToken() }));
  const actual = useRef(admin);
  actual.current = admin;
  const consultaAgenda = useRef(0);
  const cargaPanel = useRef(0);
  const solicitudes = useRef({});
  const invalidos = useRef(new Set());

  const cargarRecursos = useCallback(async (claves, token, filtros, forzar = false) => {
    const sesion = cargaPanel.current;
    await Promise.all(claves.map(async (clave) => {
      if (!forzar && (actual.current.cargas?.[clave] || actual.current.errores?.[clave])) return;
      if (!forzar && !invalidos.current.has(clave) && Date.now() - (actual.current.actualizados?.[clave] || 0) < 60000) return;
      const id = (solicitudes.current[clave] || 0) + 1;
      solicitudes.current[clave] = id;
      setAdmin((prev) => ({ ...prev, cargas: { ...prev.cargas, [clave]: true }, errores: { ...prev.errores, [clave]: "" } }));
      try {
        const resultado = await consultar(clave, token, filtros);
        if (cargaPanel.current !== sesion || solicitudes.current[clave] !== id) return;
        invalidos.current.delete(clave);
        setAdmin((prev) => ({ ...prev, [clave]: resultado, actualizados: { ...prev.actualizados, [clave]: Date.now() } }));
      } catch (error) {
        if (cargaPanel.current !== sesion || solicitudes.current[clave] !== id) return;
        if (error.status === 401) {
          cargaPanel.current += 1;
          borrarToken(); setAdmin({ ...adminBase });
          notificar.current("error", "Sesión vencida", "Inicia sesión de nuevo.");
          return;
        }
        setAdmin((prev) => ({ ...prev, errores: { ...prev.errores, [clave]: error.message } }));
      } finally {
        if (cargaPanel.current === sesion && solicitudes.current[clave] === id) setAdmin((prev) => ({ ...prev, cargas: { ...prev.cargas, [clave]: false } }));
      }
    }));
  }, []);

  const cargarAdmin = useCallback(async (token = actual.current.token, filtros = actual.current.filtros) => {
    if (!token) return false;
    const sesion = cargaPanel.current;
    setAdmin((prev) => ({ ...prev, cargando: true, errorCarga: "" }));
    try {
      if (!actual.current.perfil || actual.current.token !== token) {
        const perfil = await adminApi.perfil(token);
        if (sesion !== cargaPanel.current) return false;
        setAdmin((prev) => ({ ...prev, perfil, token, filtros }));
      }
      // Invalida las vistas no visibles sin descargarlas en cada modificación.
      invalidos.current = new Set(Object.values(recursos).flat());
      await cargarRecursos([...new Set(["dashboard", ...recursosDeSeccion(actual.current.tab)])], token, filtros, true);
      return sesion === cargaPanel.current;
    } catch (error) {
      if (sesion !== cargaPanel.current) return;
      if ([401, 403].includes(error.status)) { borrarToken(); setAdmin({ ...adminBase }); }
      else setAdmin((prev) => ({ ...prev, errorCarga: error.message }));
      notificar.current("error", "No pudimos abrir la agenda", error.message);
      return false;
    } finally {
      if (sesion === cargaPanel.current) setAdmin((prev) => ({ ...prev, cargando: false }));
    }
  }, [cargarRecursos]);

  useEffect(() => {
    if (!admin.perfil || !admin.token || admin.cargando) return;
    void cargarRecursos(recursosDeSeccion(admin.tab), admin.token, admin.filtros);
  }, [admin.tab, admin.perfil, admin.token, cargarRecursos]);

  useEffect(() => {
    const actualizar = () => {
      const estado = actual.current;
      if (document.hidden || !estado.perfil || !estado.token || estado.cargando) return;
      void cargarRecursos(recursosDeSeccion(estado.tab), estado.token, estado.filtros);
    };
    window.addEventListener("focus", actualizar);
    document.addEventListener("visibilitychange", actualizar);
    return () => { window.removeEventListener("focus", actualizar); document.removeEventListener("visibilitychange", actualizar); };
  }, [cargarRecursos]);

  useEffect(() => () => { cargaPanel.current += 1; }, []);
  return { admin: { ...admin, cargandoAgenda: Boolean(admin.cargas.citas) }, setAdmin, cargarAdmin, cargarRecursos, consultaAgenda, cargaPanel };
}
