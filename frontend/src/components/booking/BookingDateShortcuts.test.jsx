import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BookingDateShortcuts, { fechasRapidas } from "./BookingDateShortcuts";

const horarios = Array.from({ length: 7 }, (_, weekday) => ({ weekday, is_open: weekday > 0 && weekday < 6 }));

describe("Fechas rápidas", () => {
  it("respeta días cerrados y cruza el mes sin cambiar la fecha por zona horaria", () => {
    expect(fechasRapidas("2026-10-31", horarios).map((item) => item.fecha)).toEqual(["2026-10-31", "2026-11-03", "2026-11-04"]);
  });
  it("elegir una fecha no confirma ni cambia la hora automáticamente", () => {
    const elegir = vi.fn();
    render(<BookingDateShortcuts desde="2026-10-06" horarios={horarios} seleccionada="2026-10-06" onSeleccionar={elegir} />);
    const boton = screen.getByRole("button", { name: /Hoy/ });
    expect(boton).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Mañana/ }));
    expect(elegir).toHaveBeenCalledWith("2026-10-07");
  });
});
