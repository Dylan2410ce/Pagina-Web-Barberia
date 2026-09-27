import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminServices from "./AdminServices";
import AdminAgenda from "./AdminAgenda";

const servicios = [{ id: "s1", name: "Corte clásico", price: 5000, duration_min: 45, is_active: true }, { id: "s2", name: "Barba", price: 3000, duration_min: 45, is_active: false }];
describe("gestión del panel", () => {
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
