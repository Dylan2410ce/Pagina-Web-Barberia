import { adminApi, publicoApi } from "../api/client";
import { limpiarTelefono, validarTelefono, hoyISO } from "../utils/format";
import { CONTACT_KEY, nuevaReserva, nuevoRequestId } from "../utils/bookingDraft";
import { guardarReservaLocal, leerReservasGuardadas } from "../utils/bookingStorage";

export default function useClientBookings({ reserva, recordarContacto, barberoActivo, servicioActivo, datos, admin, codigoBusqueda, citaConfirmada, modalReprogramar, avisar, setProcesando, setReserva, setReservasGuardadas, setCodigoBusqueda, setCitasCliente, setCitaConfirmada, setConfirmacion, setModalReprogramar, setPasoSolicitado, cargarSlots, cargarAdmin, irAReserva }) {
  const crearCita = async (event) => {
    event.preventDefault();
    const telefono = limpiarTelefono(reserva.client_phone);
    if (!barberoActivo) return avisar("warning", "Escoge un barbero");
    if (!servicioActivo) return avisar("warning", "Escoge un servicio");
    if (reserva.start_min === null) return avisar("warning", "Escoge una hora");
    if (!validarTelefono(telefono)) return avisar("warning", "Revisa el teléfono", "Usa 8 dígitos de Costa Rica.");

    setProcesando("Reservando tu espacio...");
    try {
      const citaCreada = await publicoApi.crearCita({
        ...reserva,
        client_phone: telefono,
        client_email: reserva.client_email.trim() || null,
        notes: reserva.notes.trim() || null,
      });
      try {
        if (recordarContacto) {
          localStorage.setItem(CONTACT_KEY, JSON.stringify({
            client_name: reserva.client_name.trim(),
            client_phone: telefono,
            client_email: reserva.client_email.trim(),
          }));
        } else {
          localStorage.removeItem(CONTACT_KEY);
        }
      } catch { /* El almacenamiento local no condiciona una reserva confirmada. */ }
      guardarReservaLocal(citaCreada);
      setReservasGuardadas(leerReservasGuardadas());
      setCodigoBusqueda(citaCreada.access_code);
      setCitasCliente([{ ...citaCreada, _access_code: citaCreada.access_code }]);
      setCitaConfirmada({
        cita: citaCreada,
        aviso: {
          tipo: "ok",
          titulo: "Reserva confirmada",
          mensaje: "Guardamos tu cita y protegimos el horario.",
        },
      });
      const limpia = {
        ...nuevaReserva(recordarContacto),
        barber_id: reserva.barber_id,
        service_id: reserva.service_id,
        addon_ids: [],
        date: reserva.date,
      };
      setReserva(limpia);
      void cargarSlots(limpia);
    } catch (error) {
      avisar("error", "No se pudo reservar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const cargarCitaPorCodigo = async (codigo, notificar = true) => {
    const limpio = String(codigo || "").trim().toUpperCase();
    if (limpio.replace(/[^A-Z0-9]/g, "").length < 16) {
      avisar("warning", "Revisa el código", "Debe verse como SB-XXXX-XXXX-XXXX-XXXX.");
      return false;
    }
    setProcesando("Abriendo tu reserva...");
    try {
      const [cita, historial] = await Promise.all([
        publicoApi.buscarPorCodigo(limpio),
        publicoApi.historialPorCodigo(limpio),
      ]);
      setCodigoBusqueda(limpio);
      setCitasCliente(historial.map((item) => (
        item.id === cita.id
          ? { ...item, _access_code: limpio }
          : item
      )));
      if (notificar) avisar("ok", "Reserva encontrada");
      return true;
    } catch (error) {
      setCitasCliente([]);
      avisar("error", "No encontramos la reserva", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const buscarCitaCodigo = async (event) => {
    event.preventDefault();
    await cargarCitaPorCodigo(codigoBusqueda);
  };

  const ejecutarCancelacionCliente = async (cita) => {
    const accessCode = cita._access_code || "";
    if (!accessCode) {
      return avisar("warning", "Falta el código de reserva");
    }
    setProcesando("Liberando el espacio...");
    try {
      const actualizada = await publicoApi.cancelarCita(cita.id, {
        access_code: accessCode || null,

        reason: "Cancelada desde la web",
      });
      if (accessCode) {
        setCitasCliente([{ ...actualizada, _access_code: accessCode }]);
      }
      void cargarSlots();
      avisar("ok", "Cita cancelada");
    } catch (error) {
      avisar("error", "No se pudo cancelar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const cancelarCliente = (cita) => {
    if (!cita?._access_code) {
      avisar("warning", "Consulta la reserva antes de continuar");
      return;
    }
    setConfirmacion({
      title: "¿Cancelar esta cita?",
      message: "El horario volverá a quedar disponible para otra persona.",
      confirmLabel: "Sí, cancelar",
      danger: true,
      onConfirm: () => ejecutarCancelacionCliente(cita),
    });
  };

  const cerrarConfirmacionCita = () => {
    const aviso = citaConfirmada?.aviso;
    setCitaConfirmada(null);
    if (aviso) {
      avisar(aviso.tipo, aviso.titulo, aviso.mensaje);
    }
  };

  const abrirReprogramar = async (cita, modo) => {
    const barberId = modo === "admin" ? admin.perfil?.id : cita.barber_id;
    if (!barberId) {
      avisar("error", "No identificamos la agenda de esta cita");
      return;
    }
    const serviciosModal = modo === "admin"
      ? admin.servicios.filter((item) => !item.is_addon && item.is_active)
      : datos.services;
    const servicio = serviciosModal.find((item) => item.id === cita.service_id)
      || serviciosModal.find((item) => item.name === cita.service_name)
      || serviciosModal[0];
    if (!servicio) {
      avisar("error", "No encontramos el servicio de esta cita");
      return;
    }
    setModalReprogramar({
      cita,
      modo,
      barber_id: barberId,
      service_id: servicio.id,
      date: hoyISO(),
      start_min: null,
      slots: [],
      cargando: true,
    });
    try {
      const disponibles = await publicoApi.disponibilidad({
        barberId,
        fecha: hoyISO(),
        serviceId: servicio?.id,
        addonIds: [],
      });
      setModalReprogramar((actual) => actual && actual.cita.id === cita.id && actual.date === hoyISO() ? { ...actual, slots: disponibles, cargando: false } : actual);
    } catch (error) {
      avisar("error", "No pudimos leer horas libres", error.message);
      setModalReprogramar((actual) => actual ? { ...actual, cargando: false } : actual);
    }
  };

  const cambiarFechaModal = async (date) => {
    if (!modalReprogramar) return;
    setModalReprogramar((actual) => ({ ...actual, date, start_min: null, cargando: true }));
    try {
      const disponibles = await publicoApi.disponibilidad({
        barberId: modalReprogramar.barber_id,
        fecha: date,
        serviceId: modalReprogramar.service_id,
        addonIds: [],
      });
      setModalReprogramar((actual) => (
        actual?.cita.id === modalReprogramar.cita.id && actual.date === date
          ? { ...actual, slots: disponibles, cargando: false }
          : actual
      ));
    } catch (error) {
      avisar("error", "No pudimos leer horas libres", error.message);
      setModalReprogramar((actual) => actual && actual.date === date ? { ...actual, slots: [], cargando: false } : actual);
    }
  };

  const confirmarReprogramacion = async () => {
    if (!modalReprogramar?.start_min) return avisar("warning", "Escoge una hora");
    setProcesando("Moviendo la cita...");
    try {
      if (modalReprogramar.modo === "cliente") {
        const accessCode = modalReprogramar.cita._access_code || "";
        const actualizada = await publicoApi.reprogramarCita(modalReprogramar.cita.id, {
          access_code: accessCode || null,

          date: modalReprogramar.date,
          start_min: modalReprogramar.start_min,
        });
        if (accessCode) {
          const citaSegura = { ...actualizada, _access_code: accessCode };
          setCitasCliente([citaSegura]);
          guardarReservaLocal({ ...actualizada, access_code: accessCode });
          setReservasGuardadas(leerReservasGuardadas());
        }
      } else {
        await adminApi.moverCita(admin.token, modalReprogramar.cita.id, {
          date: modalReprogramar.date,
          start_min: modalReprogramar.start_min,
        });
        await cargarAdmin();
      }
      setModalReprogramar(null);
      void cargarSlots();
      avisar("ok", "Cita reprogramada");
    } catch (error) {
      avisar("error", "No se pudo reprogramar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const crearListaEspera = async (data) => {
    if (!barberoActivo || !servicioActivo) {
      avisar("warning", "Elige servicio y barbero");
      return false;
    }
    setProcesando("Guardando tu solicitud...");
    try {
      await publicoApi.listaEspera({
        barber_id: barberoActivo.id,
        service_id: servicioActivo.id,
        desired_date: reserva.date,
        ...data,
      });
      avisar(
        "ok",
        "Estás en la lista",
        `Te contactaremos si se libera un espacio el ${reserva.date}.`,
      );
      return true;
    } catch (error) {
      avisar("error", "No se pudo guardar", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const repetirCita = async (cita) => {
    const servicio = datos.services.find((item) => item.id === cita.service_id)
      || datos.services.find((item) => item.name === cita.service_name);
    if (!servicio) {
      avisar("warning", "Ese servicio ya no está disponible");
      return;
    }
    const addonIds = datos.addons
      .filter((item) => cita.addons?.includes(item.name))
      .map((item) => item.id);
    const siguiente = {
      ...nuevaReserva(recordarContacto),
      barber_id: cita.barber_id,
      service_id: servicio.id,
      addon_ids: addonIds,
      client_name: cita.client_name || "",
      client_phone: cita.client_phone || "",
      client_email: cita.client_email || "",
    };
    setReserva(siguiente);
    await cargarSlots(siguiente);
    setPasoSolicitado({ step: 2, key: Date.now() });
    irAReserva();
    avisar("ok", "Reserva preparada", "Solo falta elegir la nueva fecha y hora.");
  };

  const crearReseña = async (data) => {
    setProcesando("Enviando tu reseña...");
    try {
      await publicoApi.crearReseña(data);
      avisar("ok", "Gracias por tu reseña", "Se publicará después de revisarla.");
      return true;
    } catch (error) {
      avisar("error", "No se pudo enviar", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const crearEncuesta = async (data) => {
    setProcesando("Guardando tu opinión...");
    try {
      await publicoApi.crearEncuesta(data);
      avisar("ok", "Gracias por ayudarnos", "Tu respuesta es privada.");
      return true;
    } catch (error) {
      avisar("error", "No se pudo enviar", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const elegirEstilo = (estilo) => {
    const referencia = `Referencia: ${estilo.nombre}`;
    setReserva((actual) => ({
      ...actual,
      notes: actual.notes.includes(referencia)
        ? actual.notes
        : [referencia, actual.notes].filter(Boolean).join(". ").slice(0, 240),
      request_id: nuevoRequestId(),
    }));
    avisar("ok", "Referencia guardada", "La verás en el último paso de tu reserva.");
    irAReserva();
  };


  return { crearCita, cargarCitaPorCodigo, buscarCitaCodigo, ejecutarCancelacionCliente, cancelarCliente, cerrarConfirmacionCita, abrirReprogramar, cambiarFechaModal, confirmarReprogramacion, crearListaEspera, repetirCita, crearReseña, crearEncuesta, elegirEstilo };
}
