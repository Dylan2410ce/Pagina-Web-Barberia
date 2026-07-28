import { describe, expect, it } from "vitest";

import { crearPayloadsEmail } from "./emailjsService";

describe("correo de reserva", () => {
  it("incluye clave, QR y enlaces de gestión y ubicación", async () => {
    const payloads = await crearPayloadsEmail(
      {
        id: "appointment-1",
        access_code: "SB-PRUEBA-2026",
        barber_name: "Sebastián",
        barber_id: "barber-1",
        client_name: "Dylan Calvo",
        client_phone: "88887777",
        client_email: "dylan@example.com",
        service_name: "Corte Premium",
        total_price: 6000,
        starts_at: "2026-08-03T14:00:00Z",
        ends_at: "2026-08-03T14:45:00Z",
        addons: [],
      },
      {
        barbero: { name: "Sebastián" },
        duracion: 45,
        extras: [],
      },
      "sebasbarberg2021@gmail.com",
    );

    expect(payloads.cliente.access_code).toBe("SB-PRUEBA-2026");
    expect(payloads.cliente.manage_url).toContain(
      "?reserva=SB-PRUEBA-2026#mis-citas",
    );
    expect(payloads.cliente.qr_code).toMatch(/^data:image\/png;base64,/);
    expect(payloads.cliente.has_qr).toBe(true);
    expect(payloads.cliente.maps_url).toContain("google.com/maps");
    expect(payloads.cliente.waze_url).toContain("waze.com/ul");
  });
});
