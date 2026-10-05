import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminNavigation from "./AdminNavigation";
import AdminDashboard from "./AdminDashboard";
import AppointmentActions from "./AppointmentActions";
import AdminServices from "./AdminServices";

describe("Navegación del panel", () => {
  it("el catálogo de solo lectura no ofrece acciones que la API prohíbe", () => {
    render(<AdminServices puedeEditar={false} servicios={[{ id: "1", name: "Corte Premium", price: 6000, duration_min: 45, is_active: true }]} onGuardar={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Corte Premium" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nuevo servicio" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Corte Premium" })).not.toBeInTheDocument();
  });
  it("agrupa las herramientas secundarias y mantiene accesible la sección activa", () => {
    render(<AdminNavigation seccion="seguridad" onSeleccionar={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Mi cuenta" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Negocio" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: "Seguridad e integraciones" }).getAttribute("aria-current")).toBe("page");
  });

  it("abre Más en móvil y permite navegar sin un selector confuso", () => {
    const seleccionar = vi.fn();
    render(<AdminNavigation seccion="resumen" onSeleccionar={seleccionar} />);
    fireEvent.click(screen.getByRole("button", { name: "Más" }));
    fireEvent.click(screen.getByRole("button", { name: "Reportes" }));
    expect(seleccionar).toHaveBeenCalledWith("reportes");
    expect(screen.queryByRole("heading", { name: "Negocio" })).not.toBeInTheDocument();
  });

  it("muestra por atender y permite revisar las citas completadas", () => {
    const citas = [
      { id: "1", starts_at: "2026-10-04T08:00:00-06:00", status: "confirmed", client_name: "Pendiente", service_name: "Corte", total_price: 5000 },
      { id: "2", starts_at: "2026-10-04T09:00:00-06:00", status: "completed", client_name: "Atendido", service_name: "Corte", total_price: 5000 },
    ];
    render(<AdminDashboard data={{ today: "2026-10-04" }} fechaAgenda="2026-10-04" citas={citas} onTab={vi.fn()} onEstado={vi.fn()} onMover={vi.fn()} />);
    expect(screen.getByText("Pendiente", { selector: "h3" })).toBeInTheDocument();
    expect(screen.queryByText("Atendido", { selector: "h3" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Todas/ }));
    expect(screen.getByText("Atendido", { selector: "h3" })).toBeInTheDocument();
  });

  it("un bloqueo no permite reprogramar como si fuera una cita", () => {
    render(<AppointmentActions cita={{ id: "1", status: "blocked" }} onEstado={vi.fn()} onMover={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Acciones de bloqueo" }));
    expect(screen.queryByText("Reprogramar")).not.toBeInTheDocument();
    expect(screen.getByText("Liberar horario")).toBeInTheDocument();
  });
});
