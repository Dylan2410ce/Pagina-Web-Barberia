import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminBlocks from "./AdminBlocks";

const preparar = (resultado = { total: 0, appointments: [] }) => {
  const acciones = {
    onPreview: vi.fn().mockResolvedValue(resultado),
    onBloqueo: vi.fn().mockResolvedValue(true),
    onAusencia: vi.fn(), onEliminarAusencia: vi.fn(), onLiberar: vi.fn(),
  };
  render(<AdminBlocks perfil={{ name: "Sebastián" }} {...acciones} />);
  return acciones;
};

describe("revisión de bloqueos", () => {
  it("exige revisar antes de confirmar y guarda solo tras el segundo paso", async () => {
    const acciones = preparar();
    fireEvent.click(screen.getByRole("button", { name: "Revisar bloqueo" }));
    const confirmar = await screen.findByRole("button", { name: "Confirmar bloqueo" });
    expect(acciones.onBloqueo).not.toHaveBeenCalled();
    fireEvent.click(confirmar);
    await waitFor(() => expect(acciones.onBloqueo).toHaveBeenCalledTimes(1));
    expect(acciones.onPreview).toHaveBeenCalledTimes(1);
  });

  it("vuelve a revisar cuando cambian las horas", async () => {
    const acciones = preparar();
    fireEvent.click(screen.getByRole("button", { name: "Revisar bloqueo" }));
    await screen.findByRole("button", { name: "Confirmar bloqueo" });
    fireEvent.change(screen.getByLabelText("Hasta", { selector: "input[type=time]" }), { target: { value: "10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar bloqueo" }));
    await screen.findByRole("button", { name: "Confirmar bloqueo" });
    expect(acciones.onPreview).toHaveBeenCalledTimes(2);
    expect(acciones.onBloqueo).not.toHaveBeenCalled();
  });

  it("impide confirmar si existen citas afectadas", async () => {
    const acciones = preparar({ total: 1, appointments: [{ id: "cita", client_name: "Cliente", service_name: "Corte", starts_at: "2026-10-03T08:00:00-06:00" }] });
    fireEvent.click(screen.getByRole("button", { name: "Revisar bloqueo" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Revisar bloqueo" })).toBeDisabled());
    expect(acciones.onBloqueo).not.toHaveBeenCalled();
  });
});
