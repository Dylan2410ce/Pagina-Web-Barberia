import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ServiceMenu from "./ServiceMenu";

describe("menú de servicios", () => {
  it("preselecciona el servicio con un botón y sin cambiar la URL", () => {
    const seleccionar = vi.fn();
    const url = window.location.href;
    render(<ServiceMenu servicios={[{ id: "premium", name: "Corte Premium", price: 6000, duration_min: 45 }]} extras={[]} onSeleccionar={seleccionar} />);
    fireEvent.click(screen.getByRole("button", { name: "Reservar Corte Premium" }));
    expect(seleccionar).toHaveBeenCalledWith("premium");
    expect(window.location.href).toBe(url);
    expect(screen.queryByRole("tab", { name: "Combos" })).not.toBeInTheDocument();
  });
});
