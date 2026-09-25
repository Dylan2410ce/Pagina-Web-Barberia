import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

afterEach(() => vi.unstubAllGlobals());

describe("portada independiente de Render", () => {
  it("muestra la portada mientras la API no responde", async () => {
    vi.stubGlobal("IntersectionObserver", class {
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal("fetch", vi.fn((url) => url === "/api/site-status"
      ? Promise.resolve({ ok: true, json: async () => ({ maintenance_enabled: false }) })
      : new Promise(() => {})));
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Sebas Barber" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Reservar cita online/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Estamos abriendo la agenda.")).toBeVisible());
  });
});
