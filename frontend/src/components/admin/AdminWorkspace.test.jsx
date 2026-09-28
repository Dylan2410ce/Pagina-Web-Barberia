import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminServices from "./AdminServices";
import AdminAgenda from "./AdminAgenda";
import AdminDashboard from "./AdminDashboard";
import AppointmentActions from "./AppointmentActions";

const servicios = [{ id: "s1", name: "Corte clásico", price: 5000, duration_min: 45, is_active: true }, { id: "s2", name: "Barba", price: 3000, duration_min: 45, is_active: false }];
describe("gestión del panel", () => {
  it("ofrece asistencia y ausencia como acciones visibles", () => {
    const cambiar = vi.fn();
    render(<AppointmentActions cita={{ id: "a1", status: "confirmed", client_name: "Andrés" }} onEstado={cambiar} onMover={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Atendido", exact: true }));
    expect(cambiar).toHaveBeenCalledWith("a1", "completed");
    fireEvent.click(screen.getByRole("button", { name: "No llegó", exact: true }));
    expect(cambiar).toHaveBeenCalledWith("a1", "no_show");
  });
  it("separa las citas de hoy de las reservas de otros días", () => {
    const cita = { id: "a1", starts_at: "2026-09-29T08:00:00-06:00", status: "confirmed", client_name: "Andrés", service_name: "Corte Premium", total_price: 6000 };
    render(<AdminDashboard data={{ today: "2026-09-29", upcoming: [cita] }} fechaAgenda="2026-09-29" citas={[cita, { ...cita, id: "a2", starts_at: "2026-09-30T08:00:00-06:00", client_name: "Otro día" }]} onTab={vi.fn()} onEstado={vi.fn()} onMover={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Andrés" })).toBeInTheDocument();
    expect(screen.queryByText("Otro día")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atendido", exact: true })).toBeVisible();
  });
  it("filtra el catálogo sin tildes y abre la edición en la misma vista", () => {
    render(<AdminServices servicios={servicios} onGuardar={vi.fn()} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "clasico" } });
    expect(screen.queryByRole("heading", { name: "Barba" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar Corte clásico" }));
    expect(screen.getByRole("dialog", { name: "Editar servicio" })).toBeVisible();
    expect(screen.getByLabelText("Nombre del servicio")).toHaveValue("Corte clásico");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar ventana" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("filtra la agenda localmente y solicita al servidor solo el cambio de fecha", () => {
    const filtrar = vi.fn();
    const estado = vi.fn();
    const citas = [{ id: "a1", starts_at: "2026-09-29T08:00:00-06:00", client_name: "Andrés", client_phone: "88887777", service_name: "Corte", status: "confirmed", total_price: 5000 }, { id: "a2", starts_at: "2026-09-29T09:00:00-06:00", client_name: "Marcos", service_name: "Barba", status: "pending", total_price: 3000 }];
    render(<AdminAgenda admin={{ filtros: { date: "2026-09-29", q: "", status: "" }, citas }} onFiltrar={filtrar} onEstado={estado} onMover={vi.fn()} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "andres" } });
    expect(screen.getByRole("heading", { name: "Andrés" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Marcos" })).not.toBeInTheDocument();
    expect(filtrar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Acciones de Andrés" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Cancelar cita" }));
    expect(estado).toHaveBeenCalledWith("a1", "cancelled");
    fireEvent.change(screen.getByLabelText("Fecha", { exact: true }), { target: { value: "2026-09-30" } });
    expect(filtrar).toHaveBeenCalledWith({ date: "2026-09-30", q: "", status: "" });
  });
});
