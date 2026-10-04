import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ManualAppointment from "./ManualAppointment";
import { adminApi, publicoApi } from "../../api/client";

vi.mock("../../api/client", () => ({ adminApi: { servicios: vi.fn(), crearCita: vi.fn() }, publicoApi: { disponibilidad: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  adminApi.servicios.mockResolvedValue([{ id: "corte", name: "Corte Premium", price: 6000, duration_min: 45, is_active: true, is_addon: false }]);
  publicoApi.disponibilidad.mockResolvedValue([{ start_min: 480, label: "8:00 a. m." }]);
});

const completar = async () => {
  await screen.findByRole("option", { name: /Corte Premium/ });
  fireEvent.change(screen.getByLabelText("Servicio"), { target: { value: "corte" } });
  fireEvent.click(await screen.findByRole("button", { name: "8:00 a. m." }));
  fireEvent.change(screen.getByLabelText("Nombre del cliente"), { target: { value: "Cliente Prueba" } });
  fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "88888888" } });
};

describe("citas manuales", () => {
  it("conserva la misma solicitud tras un fallo de red y solo usa al barbero autenticado", async () => {
    adminApi.crearCita.mockRejectedValueOnce(new TypeError("Sin conexión")).mockResolvedValueOnce({ client_name: "Cliente Prueba", service_name: "Corte Premium", starts_at: "2026-10-03T08:00:00-06:00", total_price: 6000, access_code: "PRUEBA" });
    const onCreated = vi.fn();
    render(<ManualAppointment admin={{ token: "token", perfil: { id: "sebas", name: "Sebastián" } }} onClose={vi.fn()} onCreated={onCreated} />);
    await completar();
    fireEvent.click(screen.getByRole("button", { name: "Guardar cita" }));
    fireEvent.click(await screen.findByRole("button", { name: "Comprobar reserva" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const primera = adminApi.crearCita.mock.calls[0];
    expect(primera[1].barber_id).toBe("sebas");
    expect(adminApi.crearCita.mock.calls[1]).toEqual(primera);
    expect(await screen.findByText("PRUEBA")).toBeInTheDocument();
  });

  it("muestra un conflicto aunque vuelva a cargar los horarios", async () => {
    adminApi.crearCita.mockRejectedValueOnce(Object.assign(new Error("El horario acaba de ocuparse."), { status: 409 }));
    render(<ManualAppointment admin={{ token: "token", perfil: { id: "sebas", name: "Sebastián" } }} onClose={vi.fn()} onCreated={vi.fn()} />);
    await completar();
    fireEvent.click(screen.getByRole("button", { name: "Guardar cita" }));
    await waitFor(() => expect(publicoApi.disponibilidad).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("alert")).toHaveTextContent("El horario acaba de ocuparse.");
    expect(screen.getByRole("button", { name: "Guardar cita" })).toBeDisabled();
  });
});
