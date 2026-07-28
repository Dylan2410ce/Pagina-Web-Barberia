import { fireEvent, render, screen } from "@testing-library/react";
import { useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import BookingWizard from "./BookingWizard";

const service = {
  id: "service-1",
  name: "Corte Premium",
  duration_min: 45,
  price: 6000,
};

const barber = {
  id: "barber-1",
  name: "Sebastián",
  role: "Barbero principal",
};

function BookingHarness({ onSubmit }) {
  const [reserva, setReserva] = useState({
    barber_id: "",
    service_id: "",
    addon_ids: [],
    date: "2026-08-03",
    start_min: null,
    client_name: "",
    client_phone: "",
    client_email: "",
    notes: "",
  });
  const resumen = useMemo(() => ({
    servicio: reserva.service_id ? service : null,
    extras: [],
    total: reserva.service_id ? service.price : 0,
    duracion: reserva.service_id ? service.duration_min : 0,
    hora: reserva.start_min === 480 ? "8:00 a. m." : "",
  }), [reserva.service_id, reserva.start_min]);

  return (
    <BookingWizard
      reserva={reserva}
      setReserva={setReserva}
      resumen={resumen}
      servicios={[service]}
      extras={[]}
      barberos={[barber]}
      barbero={reserva.barber_id ? barber : null}
      slots={[{ start_min: 480, label: "8:00 a. m." }]}
      cargandoSlots={false}
      minFecha="2026-08-01"
      onFecha={(date) => setReserva((current) => ({ ...current, date }))}
      onBarbero={(id) => setReserva((current) => ({
        ...current,
        barber_id: id,
      }))}
      onServicio={(id) => setReserva((current) => ({
        ...current,
        service_id: id,
      }))}
      onExtra={() => {}}
      onSubmit={onSubmit}
    />
  );
}

describe("flujo principal de reserva", () => {
  it("permite completar servicio, barbero, hora y datos del cliente", () => {
    const onSubmit = vi.fn((event) => event.preventDefault());
    render(<BookingHarness onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: /Corte Premium/i }));
    fireEvent.click(screen.getByRole("button", { name: /Sebastián/i }));
    fireEvent.click(screen.getByRole("button", { name: /Ver horarios/i }));
    fireEvent.click(screen.getByRole("button", { name: "8:00 a. m." }));
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));

    fireEvent.change(screen.getByLabelText("Nombre completo"), {
      target: { value: "Cliente de prueba" },
    });
    fireEvent.change(screen.getByLabelText("WhatsApp"), {
      target: { value: "88887777" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar cita/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "3",
    );
  });
});
