import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useAdminData from "./useAdminData";
import { adminApi } from "../api/client";

vi.mock("../api/client", () => ({ adminApi: { perfil: vi.fn(), dashboard: vi.fn(), citas: vi.fn(), clientes: vi.fn(), servicios: vi.fn() }, obtenerToken: () => "", borrarToken: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); adminApi.perfil.mockResolvedValue({ id: "b1", name: "Sebastián" }); adminApi.dashboard.mockResolvedValue({ appointments_today: 3 }); adminApi.citas.mockResolvedValue([]); });
describe("carga independiente del panel", () => {
  it("no confirma el acceso si falla la carga del perfil", async () => {
    adminApi.perfil.mockRejectedValueOnce(new Error("Sin conexión"));
    const { result } = renderHook(() => useAdminData(vi.fn()));
    let abierto;
    await act(async () => { abierto = await result.current.cargarAdmin("token"); });
    expect(abierto).toBe(false);
    expect(result.current.admin.errorCarga).toBe("Sin conexión");
    expect(adminApi.citas).not.toHaveBeenCalled();
  });
  it("carga solo perfil y agenda al iniciar y clientes al abrir su sección", async () => {
    adminApi.clientes.mockResolvedValue([{ name: "Cliente" }]);
    const { result } = renderHook(() => useAdminData(vi.fn()));
    await act(() => result.current.cargarAdmin("token"));
    expect(adminApi.servicios).not.toHaveBeenCalled();
    expect(adminApi.clientes).not.toHaveBeenCalled();
    act(() => result.current.setAdmin((prev) => ({ ...prev, tab: "clientes" })));
    await waitFor(() => expect(result.current.admin.clientes).toHaveLength(1));
  });
  it("no transforma una caída de la agenda en datos válidos vacíos", async () => {
    adminApi.citas.mockRejectedValueOnce(new Error("Agenda sin conexión"));
    const { result } = renderHook(() => useAdminData(vi.fn()));
    await act(() => result.current.cargarAdmin("token"));
    expect(result.current.admin.errores.citas).toBe("Agenda sin conexión");
    expect(result.current.admin.actualizados.citas).toBeUndefined();
    expect(result.current.admin.dashboard.appointments_today).toBe(3);
  });
  it("descarta resultados que llegan después de cerrar sesión", async () => {
    let resolver;
    adminApi.citas.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
    const { result } = renderHook(() => useAdminData(vi.fn()));
    let carga;
    act(() => { carga = result.current.cargarAdmin("token"); });
    await waitFor(() => expect(adminApi.citas).toHaveBeenCalled());
    act(() => { result.current.cargaPanel.current += 1; });
    await act(async () => { resolver([{ id: "privada" }]); await carga; });
    expect(result.current.admin.citas).toEqual([]);
  });
});
