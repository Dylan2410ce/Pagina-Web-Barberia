import { describe, expect, it } from "vitest";
import { googleCalendarUrl } from "./calendar";

describe("integración con calendarios personales", () => {
  it("genera un enlace de Google Calendar con intervalo y zona horaria", () => {
    const url = new URL(googleCalendarUrl({
      id: "appointment-1",
      service_name: "Corte Premium",
      addons: ["Cejas"],
      starts_at: "2026-08-03T08:00:00-06:00",
      ends_at: "2026-08-03T08:45:00-06:00",
    }, { name: "Sebastián" }));

    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("ctz")).toBe("America/Costa_Rica");
    expect(url.searchParams.get("dates")).toBe(
      "20260803T140000Z/20260803T144500Z",
    );
    expect(url.searchParams.get("details")).toContain("Sebastián");
  });
});
