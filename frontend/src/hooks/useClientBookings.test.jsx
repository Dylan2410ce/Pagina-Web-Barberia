import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useClientBookings from "./useClientBookings";
import { publicoApi } from "../api/client";
import { guardarReservaLocal, leerReservasGuardadas } from "../utils/bookingStorage";

vi.mock("../api/client", () => ({ adminApi: {}, publicoApi: { crearCita: vi.fn(), cancelarCita: vi.fn(), reprogramarCita: vi.fn() } }));
const reserva = { request_id: "request-original", barber_id: "b1", service_id: "s1", date: "2026-10-06", start_min: 480, addon_ids: [], client_name: "Cliente Prueba", client_phone: "88887777", client_email: "", notes: "" };
const creada = { ...reserva, id: "c1", access_code: "SB-AAAA-BBBB-CCCC-DDDD", starts_at: "2026-10-06T08:00:00-06:00" };
function propiedades() {
  const props = { reserva, barberoActivo: { id: "b1" }, servicioActivo: { id: "s1" }, recordarContacto: false, recordarReserva: false };
  for (const nombre of ["avisar", "setProcesando", "setReserva", "setReservasGuardadas", "setCodigoBusqueda", "setCitasCliente", "setCitaConfirmada", "setPasoSolicitado", "cargarSlots"]) props[nombre] = vi.fn();
  return props;
}
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
describe("confirmación y privacidad", () => {
  it("solo envía una cancelación aunque se pulse dos veces", async () => {
    let completar;
    publicoApi.cancelarCita.mockReturnValueOnce(new Promise((resolve) => { completar = resolve; }));
    const props = propiedades();
    const { result } = renderHook(() => useClientBookings(props));
    let primera;
    act(() => { primera = result.current.ejecutarCancelacionCliente({ ...creada, _access_code: creada.access_code }); });
    await act(() => result.current.ejecutarCancelacionCliente({ ...creada, _access_code: creada.access_code }));
    expect(publicoApi.cancelarCita).toHaveBeenCalledTimes(1);
    await act(async () => { completar(creada); await primera; });
  });
  it("solo envía una reprogramación aunque se pulse dos veces", async () => {
    let completar;
    publicoApi.reprogramarCita.mockReturnValueOnce(new Promise((resolve) => { completar = resolve; }));
    const props = { ...propiedades(), modalReprogramar: { modo: "cliente", cita: { ...creada, _access_code: creada.access_code }, date: reserva.date, start_min: 525 }, setModalReprogramar: vi.fn() };
    const { result } = renderHook(() => useClientBookings(props));
    let primera;
    act(() => { primera = result.current.confirmarReprogramacion(); });
    await act(() => result.current.confirmarReprogramacion());
    expect(publicoApi.reprogramarCita).toHaveBeenCalledTimes(1);
    await act(async () => { completar(creada); await primera; });
  });
  it("actualiza la agenda y vuelve al horario ante un conflicto", async () => {
    publicoApi.crearCita.mockRejectedValueOnce(Object.assign(new Error("Hora ocupada"), { status: 409 }));
    const props = propiedades();
    const { result } = renderHook(() => useClientBookings(props));
    await act(() => result.current.crearCita());
    expect(props.cargarSlots).toHaveBeenCalledWith({ start_min: null });
    expect(props.setPasoSolicitado).toHaveBeenCalledWith(expect.objectContaining({ step: 2 }));
    expect(result.current.errorReserva.mensaje).toBe("Hora ocupada");
  });
  it("comprueba un resultado incierto con el mismo payload y request_id", async () => {
    publicoApi.crearCita.mockRejectedValueOnce(Object.assign(new Error("Timeout"), { status: 408 })).mockResolvedValueOnce(creada);
    const props = propiedades();
    const { result, rerender } = renderHook((datos) => useClientBookings(datos), { initialProps: props });
    await act(() => result.current.crearCita());
    expect(result.current.reservaPendiente).toBe(true);
    rerender({ ...props, reserva: { ...reserva, start_min: null, request_id: "otro" } });
    await act(() => result.current.crearCita());
    expect(publicoApi.crearCita.mock.calls[1][0]).toEqual(publicoApi.crearCita.mock.calls[0][0]);
    expect(result.current.reservaPendiente).toBe(false);
    expect(leerReservasGuardadas()).toEqual([]);
  });
  it("solo guarda el código con consentimiento y permite olvidarlo", async () => {
    publicoApi.crearCita.mockResolvedValueOnce(creada);
    const props = { ...propiedades(), recordarReserva: true };
    const { result } = renderHook(() => useClientBookings(props));
    await act(() => result.current.crearCita());
    expect(leerReservasGuardadas()).toHaveLength(1);
    act(() => result.current.olvidarReserva(creada.access_code));
    expect(leerReservasGuardadas()).toHaveLength(0);
  });
});
