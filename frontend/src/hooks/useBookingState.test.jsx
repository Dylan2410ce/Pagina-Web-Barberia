import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useBookingState from "./useBookingState";
import { publicoApi } from "../api/client";

vi.mock("../api/client", () => ({ publicoApi: { disponibilidad: vi.fn() } }));
const datos = { barbers: [], services: [], addons: [], business_hours: [] };
const seleccion = { barber_id: "b1", service_id: "s1", date: "2026-10-06" };
describe("disponibilidad recuperable", () => {
  it("mantiene el error separado de una agenda vacía y permite reintentar", async () => {
    publicoApi.disponibilidad.mockRejectedValueOnce(new Error("Sin conexión")).mockResolvedValueOnce([{ start_min: 480, label: "8:00" }]);
    const { result } = renderHook(() => useBookingState(datos, vi.fn()));
    await act(() => result.current.cargarSlots(seleccion));
    expect(result.current.errorSlots).toBe("Sin conexión");
    expect(result.current.cargandoSlots).toBe(false);
    await act(() => result.current.cargarSlots(seleccion));
    expect(result.current.errorSlots).toBe("");
    expect(result.current.slots).toHaveLength(1);
  });
  it("ignora una respuesta tardía de otra fecha", async () => {
    let resolver;
    publicoApi.disponibilidad.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; })).mockResolvedValueOnce([]);
    const { result } = renderHook(() => useBookingState(datos, vi.fn()));
    let anterior;
    act(() => { anterior = result.current.cargarSlots(seleccion); });
    await act(() => result.current.cargarSlots({ ...seleccion, date: "2026-10-07" }));
    await act(async () => { resolver([{ start_min: 480 }]); await anterior; });
    expect(result.current.slots).toEqual([]);
  });
});
