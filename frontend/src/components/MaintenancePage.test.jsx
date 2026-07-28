import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import MaintenancePage from "./MaintenancePage";

describe("MaintenancePage", () => {
  it("muestra el mensaje remoto y permite revisar el estado", () => {
    const onRefresh = vi.fn();
    render(
      <MaintenancePage
        status={{
          maintenance_title: "Volvemos en un momento.",
          maintenance_message: "Estamos ajustando la agenda.",
          maintenance_note: "Gracias por esperar.",
          checking: false,
        }}
        onRefresh={onRefresh}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Volvemos en un momento." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Estamos ajustando la agenda.")).toBeInTheDocument();
    expect(screen.getByText("Dylan Calvo Escobar")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Instagram de Sebastián" }),
    ).toHaveAttribute("href", "https://www.instagram.com/__andres29__/");

    fireEvent.click(
      screen.getByRole("button", { name: "Intentar de nuevo" }),
    );
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
