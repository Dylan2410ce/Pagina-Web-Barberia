import { useCallback, useState } from "react";
import { adminApi, publicoApi, borrarToken, guardarToken, obtenerToken } from "../api/client";
import { hoyISO, mesActual, fechaHumana, horaAMinutos } from "../utils/format";
import { normalizarBarberos } from "../utils/barbers";

const adminBase = {
  token: "",
  perfil: null,
  dashboard: null,
  citas: [],
  bloqueos: [],
  servicios: [],
  horarios: [],
  ausencias: [],
  clientes: [],
  actividad: [],
  listaEspera: [],
  reseñas: [],
  galeria: [],
  operaciones: {
    settings: null,
    breaks: [],
    promotions: [],
    expenses: [],
    cash_closes: [],
    notifications: [],
    feedback: [],
    metrics: null,
  },
  stats: null,
  tab: "resumen",
  filtros: { date: hoyISO(), status: "", q: "" },
};


export default function useAdminController({ avisar, setProcesando, setConfirmacion, setDatos, cargarSlots }) {
  const [admin, setAdmin] = useState(() => ({ ...adminBase, token: obtenerToken() }));
  const cargarAdmin = useCallback(async (tokenActual = admin.token, filtrosActuales = admin.filtros) => {
    if (!tokenActual) return;
    const { year, month } = mesActual();
    const limpiar = Object.fromEntries(Object.entries(filtrosActuales).filter(([, valor]) => valor !== ""));
    try {
      const perfil = await adminApi.perfil(tokenActual);
      const resultados = await Promise.allSettled([
        adminApi.dashboard(tokenActual),
        adminApi.citas(tokenActual, limpiar),
        adminApi.bloqueos(tokenActual),
        adminApi.servicios(tokenActual),
        adminApi.horarios(tokenActual),
        adminApi.ausencias(tokenActual),
        adminApi.clientes(tokenActual),
        adminApi.stats(tokenActual, year, month),
        adminApi.actividad(tokenActual),
        adminApi.listaEspera(tokenActual),
        adminApi.reseñas(tokenActual),
        adminApi.galeria(tokenActual),
        adminApi.operaciones(tokenActual),
      ]);

      const valor = (index, fallback) => resultados[index].status === "fulfilled" ? resultados[index].value : fallback;
      const cargaParcial = resultados.some((resultado) => resultado.status === "rejected");

      setAdmin((actual) => ({
        ...actual,
        token: tokenActual,
        perfil,
        dashboard: valor(0, actual.dashboard || {}),
        citas: valor(1, actual.citas || []),
        bloqueos: valor(2, actual.bloqueos || []),
        servicios: valor(3, actual.servicios || []),
        horarios: valor(4, actual.horarios || []),
        ausencias: valor(5, actual.ausencias || []),
        clientes: valor(6, actual.clientes || []),
        stats: valor(7, actual.stats || {}),
        actividad: valor(8, actual.actividad || []),
        listaEspera: valor(9, actual.listaEspera || []),
        reseñas: valor(10, actual.reseñas || []),
        galeria: valor(11, actual.galeria || []),
        operaciones: valor(12, actual.operaciones || adminBase.operaciones),
      }));

      if (cargaParcial) {
        avisar("warning", "Panel cargado", "Algunos datos tardaron, pero la agenda sigue disponible.");
      }
    } catch (error) {
      if ([401, 403].includes(error.status)) {
        borrarToken();
        setAdmin(adminBase);
        avisar("error", "Sesión vencida", error.message);
      } else {
        avisar("error", "El panel está tardando", error.message);
      }
    }
  }, [admin.filtros, admin.token, avisar]);

  const loginAdmin = async (data) => {
    setProcesando("Entrando al panel...");
    try {
      const respuesta = await adminApi.login(data);
      guardarToken(respuesta.token);
      setAdmin((actual) => ({ ...actual, token: respuesta.token }));
      await cargarAdmin(respuesta.token, admin.filtros);
      avisar("ok", "Panel abierto");
      return true;
    } catch (error) {
      avisar("error", "No se pudo entrar", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const resetPassword = async (data) => {
    setProcesando("Actualizando clave...");
    try {
      await adminApi.resetPassword(data);
      avisar("ok", "Clave actualizada", "Ya puedes entrar con tu nueva contraseña.");
      return true;
    } catch (error) {
      avisar("error", "No se pudo cambiar", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const cambiarPassword = async (data) => {
    setProcesando("Actualizando clave...");
    try {
      await adminApi.changePassword(admin.token, data);
      borrarToken();
      setAdmin({ ...adminBase });
      avisar("ok", "Clave actualizada", "Inicia sesión de nuevo para continuar.");
      return true;
    } catch (error) {
      avisar("error", "No se pudo cambiar", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const cerrarAdmin = () => {
    borrarToken();
    setAdmin(adminBase);
    avisar("ok", "Sesión cerrada");
  };

  const cambiarTabAdmin = (tab) => {
    setAdmin((actual) => ({ ...actual, tab }));
  };

  const filtrarAdmin = async (filtros) => {
    const limpiar = Object.fromEntries(
      Object.entries(filtros).filter(([, valor]) => valor !== ""),
    );
    setAdmin((actual) => ({ ...actual, filtros }));
    try {
      const citas = await adminApi.citas(admin.token, limpiar);
      setAdmin((actual) => ({ ...actual, citas }));
    } catch (error) {
      avisar("error", "No pudimos filtrar la agenda", error.message);
    }
  };

  const cambiarEstadoAdmin = async (id, status) => {
    setProcesando("Actualizando agenda...");
    try {
      const actualizada = await adminApi.estadoCita(admin.token, id, status);
      await cargarAdmin();
      await cargarSlots();
      avisar("ok", "Agenda actualizada");
    } catch (error) {
      avisar("error", "No se pudo actualizar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const solicitarEstadoAdmin = (id, status) => {
    if (!["cancelled", "no_show"].includes(status)) {
      cambiarEstadoAdmin(id, status);
      return;
    }
    const cita = [...admin.citas, ...admin.bloqueos].find((item) => item.id === id);
    const esBloqueo = cita?.status === "blocked";
    setConfirmacion({
      title: esBloqueo
        ? "¿Liberar este horario?"
        : status === "no_show"
          ? "¿Marcar como ausencia?"
          : "¿Cancelar esta cita?",
      message: esBloqueo
        ? "El espacio volverá a aparecer disponible en la agenda."
        : status === "no_show"
          ? "La cita quedará registrada como no asistida."
          : "La reserva se cancelará y el horario quedará libre.",
      confirmLabel: esBloqueo
        ? "Liberar horario"
        : status === "no_show"
          ? "Marcar ausencia"
          : "Cancelar cita",
      danger: true,
      onConfirm: () => cambiarEstadoAdmin(id, status),
    });
  };

  const crearBloqueo = async (data) => {
    setProcesando("Bloqueando espacio...");
    try {
      await adminApi.crearBloqueo(admin.token, data);
      await cargarAdmin();
      await cargarSlots();
      avisar("ok", "Espacio bloqueado");
      return true;
    } catch (error) {
      avisar("error", "No se pudo bloquear", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const crearAusencia = async (data) => {
    setProcesando("Guardando disponibilidad...");
    try {
      await adminApi.crearAusencia(admin.token, data);
      await cargarAdmin();
      await cargarSlots();
      avisar("ok", "Disponibilidad actualizada");
      return true;
    } catch (error) {
      avisar("error", "No se pudo guardar", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const eliminarAusencia = async (id) => {
    setProcesando("Actualizando agenda...");
    try {
      await adminApi.eliminarAusencia(admin.token, id);
      await cargarAdmin();
      await cargarSlots();
      avisar("ok", "Ausencia eliminada");
    } catch (error) {
      avisar("error", "No se pudo eliminar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const bloquearProximoEspacio = async () => {
    setProcesando("Buscando el próximo espacio...");
    try {
      const bloqueo = await adminApi.bloqueoRapido(admin.token, {
        duration_min: 45,
        horizon_days: 14,
        notes: "Bloqueo rápido desde el panel",
      });
      await cargarAdmin();
      await cargarSlots();
      avisar("ok", "Espacio bloqueado", fechaHumana(bloqueo.starts_at));
    } catch (error) {
      avisar("error", "No se pudo crear el bloqueo", error.message);
    } finally {
      setProcesando("");
    }
  };

  const guardarServicio = async (event, id = null) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const payload = {
      name: data.name.trim(),
      duration_min: Number(data.duration_min || 0),
      price: Number(data.price || 0),
      is_addon: data.is_addon === "on",
      is_active: id ? data.is_active === "on" : true,
    };
    setProcesando(id ? "Guardando servicio..." : "Creando servicio...");
    try {
      if (id) await adminApi.editarServicio(admin.token, id, payload);
      else await adminApi.crearServicio(admin.token, payload);
      const bootstrap = await publicoApi.iniciar();
      setDatos((actual) => ({ ...actual, services: bootstrap.services || [], addons: bootstrap.addons || [] }));
      await cargarAdmin();
      avisar("ok", id ? "Servicio actualizado" : "Servicio creado");
    } catch (error) {
      avisar("error", "No se pudo guardar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const guardarHorario = async (event, weekday) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setProcesando("Guardando horario...");
    try {
      await adminApi.editarHorario(admin.token, weekday, {
        weekday,
        is_open: data.is_open === "on",
        open_min: horaAMinutos(data.open_time),
        close_min: horaAMinutos(data.close_time),
      });
      await cargarAdmin();
      await cargarSlots();
      avisar("ok", "Horario guardado");
    } catch (error) {
      avisar("error", "No se pudo guardar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const refrescarOperacion = async (publica = false) => {
    const tasks = [cargarAdmin()];
    if (publica) tasks.push(publicoApi.iniciar());
    const results = await Promise.all(tasks);
    const bootstrap = results[1];
    if (bootstrap) {
      setDatos((actual) => ({
        ...actual,
        barbers: normalizarBarberos(bootstrap.barbers || []),
        business_hours: bootstrap.business_hours || [],
        business_breaks: bootstrap.business_breaks || [],
        promotions: bootstrap.promotions || [],
      }));
    }
  };

  const ejecutarOperacion = async ({
    loading,
    action,
    success,
    publica = false,
  }) => {
    setProcesando(loading);
    try {
      await action();
      await refrescarOperacion(publica);
      avisar("ok", success);
      return true;
    } catch (error) {
      avisar("error", "No se pudo completar", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const guardarConfiguracion = (data) => ejecutarOperacion({
    loading: "Guardando configuración...",
    action: () => adminApi.guardarConfiguracion(admin.token, data),
    success: "Configuración guardada",
    publica: true,
  });

  const crearPausa = (data) => ejecutarOperacion({
    loading: "Añadiendo pausa...",
    action: () => adminApi.crearPausa(admin.token, data),
    success: "Pausa añadida",
    publica: true,
  });

  const eliminarPausa = (item) => setConfirmacion({
    title: "¿Eliminar esta pausa?",
    message: `${item.label} dejará de bloquear ese horario semanal.`,
    confirmLabel: "Eliminar pausa",
    danger: true,
    onConfirm: () => ejecutarOperacion({
      loading: "Eliminando pausa...",
      action: () => adminApi.eliminarPausa(admin.token, item.id),
      success: "Pausa eliminada",
      publica: true,
    }),
  });

  const crearPromocion = (data) => ejecutarOperacion({
    loading: "Publicando promoción...",
    action: () => adminApi.crearPromocion(admin.token, data),
    success: "Promoción publicada",
    publica: true,
  });

  const alternarPromocion = (item) => ejecutarOperacion({
    loading: "Actualizando promoción...",
    action: () => adminApi.editarPromocion(admin.token, item.id, {
      is_active: !item.is_active,
    }),
    success: item.is_active ? "Promoción pausada" : "Promoción activada",
    publica: true,
  });

  const eliminarPromocion = (item) => setConfirmacion({
    title: "¿Eliminar esta promoción?",
    message: `"${item.name}" desaparecerá del cálculo de precios.`,
    confirmLabel: "Eliminar promoción",
    danger: true,
    onConfirm: () => ejecutarOperacion({
      loading: "Eliminando promoción...",
      action: () => adminApi.eliminarPromocion(admin.token, item.id),
      success: "Promoción eliminada",
      publica: true,
    }),
  });

  const crearGasto = (data) => ejecutarOperacion({
    loading: "Guardando gasto...",
    action: () => adminApi.crearGasto(admin.token, data),
    success: "Gasto registrado",
  });

  const eliminarGasto = (item) => setConfirmacion({
    title: "¿Eliminar este gasto?",
    message: `${item.description} por ${item.amount} colones saldrá del reporte.`,
    confirmLabel: "Eliminar gasto",
    danger: true,
    onConfirm: () => ejecutarOperacion({
      loading: "Eliminando gasto...",
      action: () => adminApi.eliminarGasto(admin.token, item.id),
      success: "Gasto eliminado",
    }),
  });

  const crearCierre = (data) => ejecutarOperacion({
    loading: "Cerrando caja...",
    action: () => adminApi.crearCierre(admin.token, data),
    success: "Cierre diario guardado",
  });

  const actualizarCliente = (id, data) => ejecutarOperacion({
    loading: "Guardando ficha...",
    action: () => adminApi.actualizarCliente(admin.token, id, data),
    success: "Ficha actualizada",
  });

  const anonimizarCliente = (cliente) => setConfirmacion({
    title: "¿Eliminar los datos personales?",
    message: (
      `Se borrarán el nombre, teléfono, correo y notas de ${cliente.name}. `
      + "Los totales históricos se conservarán sin identificar a la persona."
    ),
    confirmLabel: "Eliminar datos",
    danger: true,
    onConfirm: () => ejecutarOperacion({
      loading: "Anonimizando cliente...",
      action: () => adminApi.anonimizarCliente(admin.token, cliente.profile_id),
      success: "Datos personales eliminados",
    }),
  });

  const descargarRespaldo = async () => {
    setProcesando("Preparando respaldo...");
    try {
      const payload = await adminApi.respaldo(admin.token);
      const blob = new Blob(
        [JSON.stringify(payload, null, 2)],
        { type: "application/json;charset=utf-8" },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `respaldo-sebas-barber-${hoyISO()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      avisar("ok", "Respaldo descargado");
    } catch (error) {
      avisar("error", "No se pudo descargar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const cambiarEstadoListaEspera = async (id, status) => {
    setProcesando("Actualizando la lista...");
    try {
      await adminApi.estadoListaEspera(admin.token, id, status);
      await cargarAdmin();
      avisar("ok", "Lista de espera actualizada");
    } catch (error) {
      avisar("error", "No se pudo actualizar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const moderarReseña = async (id, status) => {
    setProcesando("Guardando la reseña...");
    try {
      await adminApi.estadoReseña(admin.token, id, status);
      const [reviews] = await Promise.all([
        publicoApi.reseñas(),
        cargarAdmin(),
      ]);
      setDatos((actual) => ({ ...actual, reviews: reviews.items || [] }));
      avisar("ok", status === "approved" ? "Reseña publicada" : "Reseña archivada");
    } catch (error) {
      avisar("error", "No se pudo moderar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const crearImagenGaleria = async (data) => {
    setProcesando("Añadiendo trabajo...");
    try {
      await adminApi.crearImagen(admin.token, data);
      const bootstrap = await publicoApi.iniciar();
      setDatos((actual) => ({ ...actual, gallery: bootstrap.gallery || [] }));
      await cargarAdmin();
      avisar("ok", "Imagen añadida");
      return true;
    } catch (error) {
      avisar("error", "No se pudo añadir", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const subirImagenGaleria = async (formData) => {
    setProcesando("Subiendo imagen...");
    try {
      await adminApi.subirImagen(admin.token, formData);
      const bootstrap = await publicoApi.iniciar();
      setDatos((actual) => ({ ...actual, gallery: bootstrap.gallery || [] }));
      await cargarAdmin();
      avisar("ok", "Imagen publicada");
      return true;
    } catch (error) {
      avisar("error", "No se pudo subir", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const editarImagenGaleria = async (id, data) => {
    setProcesando("Actualizando galería...");
    try {
      await adminApi.editarImagen(admin.token, id, data);
      const bootstrap = await publicoApi.iniciar();
      setDatos((actual) => ({ ...actual, gallery: bootstrap.gallery || [] }));
      await cargarAdmin();
      avisar("ok", "Galería actualizada");
      return true;
    } catch (error) {
      avisar("error", "No se pudo actualizar", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const eliminarImagenGaleria = (item) => {
    setConfirmacion({
      title: "¿Eliminar esta imagen?",
      message: `"${item.title}" dejará de aparecer en el sitio.`,
      confirmLabel: "Eliminar imagen",
      danger: true,
      onConfirm: async () => {
        setProcesando("Eliminando imagen...");
        try {
          await adminApi.eliminarImagen(admin.token, item.id);
          const bootstrap = await publicoApi.iniciar();
          setDatos((actual) => ({ ...actual, gallery: bootstrap.gallery || [] }));
          await cargarAdmin();
          avisar("ok", "Imagen eliminada");
        } catch (error) {
          avisar("error", "No se pudo eliminar", error.message);
        } finally {
          setProcesando("");
        }
      },
    });
  };


  return { admin, cargarAdmin, loginAdmin, resetPassword, cambiarPassword, cerrarAdmin, cambiarTabAdmin, filtrarAdmin, cambiarEstadoAdmin, solicitarEstadoAdmin, crearBloqueo, crearAusencia, eliminarAusencia, bloquearProximoEspacio, guardarServicio, guardarHorario, refrescarOperacion, ejecutarOperacion, guardarConfiguracion, crearPausa, eliminarPausa, crearPromocion, alternarPromocion, eliminarPromocion, crearGasto, eliminarGasto, crearCierre, actualizarCliente, anonimizarCliente, descargarRespaldo, cambiarEstadoListaEspera, crearImagenGaleria, subirImagenGaleria, editarImagenGaleria, eliminarImagenGaleria, moderarReseña };
}
