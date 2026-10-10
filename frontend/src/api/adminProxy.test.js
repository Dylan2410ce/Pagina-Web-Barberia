import { describe, expect, it } from "vitest";
import { destinoBackend } from "../../api/backend/[...path].js";

describe("proxy de administración", () => {
  it("conserva consultas y limita las rutas al admin", () => {
    expect(destinoBackend("/api/backend/admin/appointments?date=2026-10-10", "https://api.example.com/"))
      .toBe("https://api.example.com/api/admin/appointments?date=2026-10-10");
    expect(destinoBackend("/api/backend/tasks/run", "https://api.example.com")).toBeNull();
    expect(destinoBackend("/api/backend/admin/../../health", "https://api.example.com")).toBeNull();
  });
  it.each(["http://api.example.com", "https://user:secret@api.example.com", "https://api.example.com?target=evil"])("rechaza destinos inseguros %s", (base) => {
    expect(() => destinoBackend("/api/backend/admin/login", base)).toThrow();
  });
});
