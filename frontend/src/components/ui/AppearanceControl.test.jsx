import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import AppearanceControl from "./AppearanceControl";

afterEach(() => { cleanup(); localStorage.clear(); document.documentElement.removeAttribute("data-theme"); });

describe("apariencia accesible", () => {
  it("permite elegir tema oscuro y claro con una etiqueta visible", () => {
    render(<AppearanceControl />);
    const selector = screen.getByRole("combobox", { name: "Apariencia" });
    fireEvent.change(selector, { target: { value: "dark" } });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(selector).toHaveValue("dark");
    fireEvent.change(selector, { target: { value: "light" } });
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
