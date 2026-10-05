import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminTeam from "./AdminTeam";
import AdminNavigation from "./AdminNavigation";
import { adminApi } from "../../api/client";

vi.mock("../../api/client", () => ({ adminApi: { crearBarbero: vi.fn(), editarBarbero: vi.fn(), retirarBarbero: vi.fn(), reactivarBarbero: vi.fn() } }));
const items = [{ id: "1", username: "sebas", name: "Sebastián", role: "Barbero principal", is_active: true, phone: "83778700" }, { id: "2", username: "nuevo", name: "Andrés", role: "Barbero", is_active: true, phone: "88887777" }];

describe("Gestión del equipo", () => {
  it("oculta el acceso a los demás barberos", () => {
    const { rerender } = render(<AdminNavigation seccion="equipo" onSeleccionar={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Equipo" })).not.toBeInTheDocument();
    rerender(<AdminNavigation seccion="equipo" onSeleccionar={vi.fn()} puedeGestionarEquipo />);
    expect(screen.getByRole("button", { name: "Equipo" })).toBeInTheDocument();
  });
  it("protege al propietario y permite buscar perfiles", () => {
    render(<AdminTeam items={items} token="local" />);
    expect(screen.getAllByRole("button", { name: "Retirar" })).toHaveLength(1);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar barbero" }), { target: { value: "Andrés" } });
    expect(screen.queryByRole("heading", { name: "Sebastián" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Andrés" })).toBeInTheDocument();
  });
  it("solicita confirmación y muestra conflictos sin ocultar el error", async () => {
    adminApi.retirarBarbero.mockRejectedValueOnce(new Error("Hay citas pendientes"));
    render(<AdminTeam items={items} token="local" />);
    fireEvent.click(screen.getByRole("button", { name: "Retirar" }));
    expect(adminApi.retirarBarbero).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar retiro" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Hay citas pendientes"));
    expect(adminApi.retirarBarbero).toHaveBeenCalledWith("local", "2");
  });
});
