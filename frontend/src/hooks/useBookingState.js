import { useCallback, useMemo, useRef, useState } from "react";
import { publicoApi } from "../api/client";
import { nuevaReserva, nuevoRequestId, leerContactoRecordado } from "../utils/bookingDraft";

export default function useBookingState(datos, avisar) {
  const ultimaSolicitud = useRef(0);
  const [reserva, setReserva] = useState(nuevaReserva);
  const [recordarContacto, setRecordarContacto] = useState(
    () => Boolean(leerContactoRecordado().client_name),
  );
  const [slots, setSlots] = useState([]);
  const [cargandoSlots, setCargandoSlots] = useState(false);

  const servicioActivo = useMemo(
    () => datos.services.find((servicio) => servicio.id === reserva.service_id),
    [datos.services, reserva.service_id],
  );

  const extrasActivos = useMemo(
    () => datos.addons.filter((extra) => reserva.addon_ids.includes(extra.id)),
    [datos.addons, reserva.addon_ids],
  );

  const barberoActivo = useMemo(
    () => datos.barbers.find((barbero) => barbero.id === reserva.barber_id),
    [datos.barbers, reserva.barber_id],
  );

  const horariosActivos = useMemo(() => {
    const barberId = barberoActivo?.id || datos.barbers[0]?.id;
    return datos.business_hours.filter((item) => item.barber_id === barberId);
  }, [barberoActivo, datos.barbers, datos.business_hours]);

  const resumen = useMemo(() => {
    const subtotal = (servicioActivo?.price || 0)
      + extrasActivos.reduce((sum, item) => sum + item.price, 0);
    const promociones = (datos.promotions || []).filter((item) => (
      item.barber_id === barberoActivo?.id
      && (!item.service_id || item.service_id === servicioActivo?.id)
      && item.start_date <= reserva.date
      && item.end_date >= reserva.date
      && item.is_active
    ));
    const aplicada = promociones
      .map((item) => ({
        ...item,
        discount: item.discount_type === "percentage"
          ? Math.round(subtotal * item.discount_value / 100)
          : item.discount_value,
      }))
      .sort((a, b) => b.discount - a.discount)[0];
    const descuento = Math.min(
      Math.max(aplicada?.discount || 0, 0),
      Math.max(subtotal - 1, 0),
    );
    return {
      barbero: barberoActivo,
      servicio: servicioActivo,
      extras: extrasActivos,
      subtotal,
      descuento,
      promocion: aplicada?.name || "",
      total: subtotal - descuento,
      duracion: servicioActivo?.duration_min || 0,
      hora: slots.find((slot) => slot.start_min === reserva.start_min)?.label || "",
    };
  }, [
    barberoActivo,
    datos.promotions,
    extrasActivos,
    reserva.date,
    reserva.start_min,
    servicioActivo,
    slots,
  ]);

  const cargarSlots = useCallback(async (override = {}) => {
    const solicitud = ++ultimaSolicitud.current;
    const siguiente = { ...reserva, ...override };
    if (!siguiente.barber_id || !siguiente.service_id || !siguiente.date) {
      setSlots([]);
      setCargandoSlots(false);
      return;
    }
    setCargandoSlots(true);
    try {
      const respuesta = await publicoApi.disponibilidad({
        barberId: siguiente.barber_id,
        fecha: siguiente.date,
        serviceId: siguiente.service_id,
        addonIds: siguiente.addon_ids,
      });
      if (solicitud === ultimaSolicitud.current) setSlots(respuesta);
    } catch (error) {
      if (solicitud !== ultimaSolicitud.current) return;
      setSlots([]);
      avisar("error", "No pudimos leer la agenda", error.message);
    } finally {
      if (solicitud === ultimaSolicitud.current) setCargandoSlots(false);
    }
  }, [avisar, reserva]);

  const seleccionarBarbero = async (id) => {
    const siguiente = {
      barber_id: id,
      start_min: null,
      request_id: nuevoRequestId(),
    };
    setReserva((actual) => ({ ...actual, ...siguiente }));
    await cargarSlots(siguiente);
  };

  const seleccionarServicio = async (id) => {
    const siguiente = {
      service_id: id,
      start_min: null,
      request_id: nuevoRequestId(),
    };
    setReserva((actual) => ({ ...actual, ...siguiente }));
    await cargarSlots(siguiente);
  };

  const toggleExtra = async (id) => {
    const addon_ids = reserva.addon_ids.includes(id)
      ? reserva.addon_ids.filter((item) => item !== id)
      : [...reserva.addon_ids, id];
    setReserva((actual) => ({
      ...actual,
      addon_ids,
      request_id: nuevoRequestId(),
    }));
  };

  const cambiarFecha = async (date) => {
    setReserva((actual) => ({
      ...actual,
      date,
      start_min: null,
      request_id: nuevoRequestId(),
    }));
    await cargarSlots({ date, start_min: null });
  };


  return { reserva, setReserva, recordarContacto, setRecordarContacto, slots, cargandoSlots, cargarSlots, servicioActivo, extrasActivos, barberoActivo, horariosActivos, resumen, seleccionarBarbero, seleccionarServicio, toggleExtra, cambiarFecha };
}
