import { useRef } from "react";
import { adminApi, publicoApi, borrarToken, guardarToken } from "../api/client";
import { hoyISO, fechaHumana, horaAMinutos } from "../utils/format";
import { normalizarBarberos } from "../utils/barbers";
import useAdminData, { adminBase } from "./useAdminData";

export default function useAdminController({ avisar, setProcesando, setConfirmacion, setDatos = () => {}, cargarSlots = () => {} }) {
  const { admin, setAdmin, cargarAdmin, cargarRecursos, consultaAgenda, cargaPanel } = useAdminData(avisar);
  const citasEnProceso = useRef(new Set());
  const bloqueoRapidoEnCurso = useRef(false);

  const loginAdmin = async (data) => {
    setProcesando("Entrando al panel...");
    try {
      const respuesta = await adminApi.login(data);
      guardarToken(respuesta.token, respuesta.csrf_token);
      setAdmin((actual) => ({ ...actual, token: respuesta.token }));
      const abierto = await cargarAdmin(respuesta.token, admin.filtros);
      if (!abierto) return false;
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

  const cerrarAdmin = async () => {
    setProcesando("Cerrando sesión…");
    try {
      await adminApi.logout();
    } catch (error) {
      if (error.status !== 401) {
        avisar("error", "No se pudo cerrar la sesión", "Comprueba tu conexión e inténtalo de nuevo.");
        return;
      }
    } finally {
      setProcesando("");
    }
    consultaAgenda.current += 1;
    cargaPanel.current += 1;
    borrarToken();
    setAdmin(adminBase);
    avisar("ok", "Sesión cerrada");
  };

  const cambiarTabAdmin = (tab) => {
    setAdmin((actual) => ({ ...actual, tab }));
    if (tab === "resumen" && admin.filtros.date !== hoyISO()) {
      filtrarAdmin({ date: hoyISO(), status: "", q: "" });
    }
  };

  const filtrarAdmin = async (filtros) => {
    setAdmin((actual) => ({ ...actual, filtros }));
    await cargarRecursos(["citas"], admin.token, filtros, true);
  };

  const cambiarEstadoAdmin = async (id, status) => {
    if (citasEnProceso.current.has(id)) return;
    citasEnProceso.current.add(id);
    setProcesando("Actualizando agenda...");
    try {
      await adminApi.estadoCita(admin.token, id, status);
      await cargarAdmin();
      await cargarSlots();
      avisar("ok", "Agenda actualizada");
    } catch (error) {
      avisar("error", "No se pudo actualizar", error.message);
    } finally {
      citasEnProceso.current.delete(id);
      setProcesando("");
    }
  };

  const solicitarEstadoAdmin = (id, status) => {
    if (!["cancelled", "no_show", "completed"].includes(status)) {
      cambiarEstadoAdmin(id, status);
      return;
    }
    const cita = [...admin.citas, ...admin.bloqueos, ...(admin.dashboard?.upcoming || [])].find((item) => item.id === id);
    const esBloqueo = cita?.status === "blocked";
    setConfirmacion({
      title: esBloqueo
        ? "¿Liberar este horario?"
        : status === "completed"
          ? "¿Cliente atendido?"
        : status === "no_show"
          ? "¿El cliente no llegó?"
          : "¿Cancelar esta cita?",
      message: esBloqueo
        ? "El espacio volverá a aparecer disponible en la agenda."
        : status === "completed"
          ? `${cita?.client_name || "El cliente"}: la cita quedará completada y el importe se sumará a tus ingresos.`
        : status === "no_show"
          ? "La cita quedará registrada como no asistida. No se sumará a tus ingresos."
          : "La reserva se cancelará y el horario quedará libre.",
      confirmLabel: esBloqueo
        ? "Liberar horario"
        : status === "completed"
          ? "Sí, atendido"
        : status === "no_show"
          ? "No llegó"
          : "Cancelar cita",
      danger: status !== "completed",
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

  const bloquearProximoEspacio = () => setConfirmacion({
    title: "¿Reservar un descanso para hoy?",
    message: "Se bloquearán 45 minutos en el próximo espacio libre de hoy. Tus citas actuales no se moverán y no se bloquearán otros días.",
    confirmLabel: "Bloquear 45 minutos",
    onConfirm: crearBloqueoRapido,
  });

  const crearBloqueoRapido = async () => {
    if (bloqueoRapidoEnCurso.current) return;
    bloqueoRapidoEnCurso.current = true;
    setProcesando("Buscando el próximo espacio...");
    try {
      const bloqueo = await adminApi.bloqueoRapido(admin.token, {
        duration_min: 45,
        horizon_days: 1,
        notes: "Bloqueo rápido desde el panel",
      });
      await cargarAdmin();
      await cargarSlots();
      avisar("ok", "Espacio bloqueado", fechaHumana(bloqueo.starts_at));
    } catch (error) {
      avisar("error", "No se pudo crear el bloqueo", error.message);
    } finally {
      bloqueoRapidoEnCurso.current = false;
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
      return true;
    } catch (error) {
      avisar("error", "No se pudo guardar", error.message);
      return false;
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
