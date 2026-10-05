import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import useBarberPreference, { leerBarberoPreferido } from "./useBarberPreference";

describe("Barbero preferido", () => {
  beforeEach(() => localStorage.clear());
  it("solo recuerda una elección con consentimiento y permite olvidarla", () => {
    const { result } = renderHook(() => useBarberPreference([{ id: "nuevo" }], "nuevo"));
    expect(leerBarberoPreferido()).toBe("");
    act(() => result.current[1](true));
    expect(leerBarberoPreferido()).toBe("nuevo");
    act(() => result.current[1](false));
    expect(leerBarberoPreferido()).toBe("");
  });
  it("olvida perfiles que ya no están en el equipo activo", () => {
    localStorage.setItem("sebas-barber:barbero-preferido", "retirado");
    renderHook(() => useBarberPreference([{ id: "activo" }], ""));
    expect(leerBarberoPreferido()).toBe("");
  });
});
