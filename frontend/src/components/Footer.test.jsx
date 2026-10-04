import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Footer from "./Footer";

describe("pie de página", () => {
  it("conserva la firma, las páginas legales y el nuevo enlace de ubicación", () => {
    render(<Footer />);
    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByText("Dylan Calvo Escobar")).toBeVisible();
    expect(footer.getByRole("link", { name: "Cómo llegar" })).toHaveAttribute("href", "https://maps.app.goo.gl/D3vDt9Dx2ijRzL8k9?g_st=ic");
    expect(footer.getByRole("link", { name: "Privacidad" })).toHaveAttribute("href", "/privacidad");
    expect(footer.getByRole("link", { name: "Términos de reserva" })).toHaveAttribute("href", "/terminos-reserva");
    expect(footer.getByRole("link", { name: "Cancelaciones" })).toHaveAttribute("href", "/aviso-cancelacion");
  });
});
