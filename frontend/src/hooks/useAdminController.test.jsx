import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useAdminController from "./useAdminController";
import { adminApi } from "../api/client";

vi.mock("../api/client", () => ({
  adminApi: { estadoCita: vi.fn() },
  publicoApi: {},
  obtenerToken: () => "",
  guardarToken: vi.fn(),
  borrarToken: vi.fn(),
}));

describe("confirmación de asistencia", () => {
  it.each(["completed", "no_show"])("pide confirmación antes de guardar %s", (estado) => {
    const confirmar = vi.fn();
    const { result } = renderHook(() => useAdminController({
      avisar: vi.fn(), setProcesando: vi.fn(), setConfirmacion: confirmar,
      setDatos: vi.fn(), cargarSlots: vi.fn(),
    }));
    act(() => result.current.solicitarEstadoAdmin("cita-prueba", estado));
    expect(adminApi.estadoCita).not.toHaveBeenCalled();
    expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({
      title: estado === "completed" ? "¿Cliente atendido?" : "¿El cliente no llegó?",
      danger: estado !== "completed",
      onConfirm: expect.any(Function),
    }));
  });
});
