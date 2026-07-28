import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BookingSuccessModal from "./BookingSuccessModal";

const cita = {
  id: "appointment-1",
  barber_id: "barber-1",
  service_name: "Corte Premium",
  client_name: "Dylan Calvo",
  total_price: 6000,
  starts_at: "2026-08-03T08:00:00-06:00",
  ends_at: "2026-08-03T08:45:00-06:00",
  access_code: "SB-ABCD-EFGH-JKLM-NPQR",
};

describe("comprobante de reserva", () => {
  it("muestra el código privado, el QR y las opciones de calendario", () => {
    const onClose = vi.fn();
    render(
      <BookingSuccessModal
        cita={cita}
        barbero={{ name: "Sebastián" }}
        onClose={onClose}
      />,
    );

    expect(screen.getByText(cita.access_code)).toBeInTheDocument();
    expect(screen.getByTitle("Código QR de la reserva")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Google Calendar/i })).toHaveAttribute(
      "href",
      expect.stringContaining("calendar.google.com"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Entendido" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
