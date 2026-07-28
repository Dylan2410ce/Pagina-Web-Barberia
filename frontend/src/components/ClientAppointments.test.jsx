import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ClientAppointments from "./ClientAppointments";

const baseProps = {
  codigo: "",
  setCodigo: vi.fn(),
  telefono: "",
  setTelefono: vi.fn(),
  citas: [],
  barberos: [],
  reservasGuardadas: [],
  onBuscarCodigo: vi.fn((event) => event.preventDefault()),
  onBuscarTelefono: vi.fn((event) => event.preventDefault()),
  onSeleccionarGuardada: vi.fn(),
  onCancelar: vi.fn(),
  onReprogramar: vi.fn(),
  onRepetir: vi.fn(),
  onReseña: vi.fn(),
};

describe("gestión de citas del cliente", () => {
  it("usa el código privado como acceso principal", () => {
    render(<ClientAppointments {...baseProps} />);

    expect(screen.getByLabelText("Código de reserva")).toBeInTheDocument();
    expect(screen.getByLabelText("Número de WhatsApp")).not.toBeVisible();
    fireEvent.click(screen.getByText("Buscar una cita antigua por teléfono"));
    expect(screen.getByLabelText("Número de WhatsApp")).toBeInTheDocument();
  });
});
