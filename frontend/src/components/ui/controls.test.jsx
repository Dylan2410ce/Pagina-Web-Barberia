import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import FormField from "./FormField";
import ActionMenu from "./ActionMenu";
import Dialog from "./Dialog";
import ConfirmDialog from "../ConfirmDialog";
import { validarNombre, validarTelefono, coincideBusqueda } from "../../utils/validation";

describe("controles accesibles", () => {
  it("valida al salir y corrige el error mientras se escribe", () => {
    render(<FormField label="Nombre" validate={validarNombre} />);
    const campo = screen.getByLabelText("Nombre");
    fireEvent.change(campo, { target: { value: "A" } });
    expect(campo).toHaveAttribute("aria-invalid", "false");
    fireEvent.blur(campo);
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/al menos 3/)).toBeVisible();
    fireEvent.change(campo, { target: { value: "Andrés" } });
    expect(campo).toHaveAttribute("aria-invalid", "false");
    expect(campo.checkValidity()).toBe(true);
  });
  it("navega acciones con teclado, restaura el foco y no ejecuta al cerrar", () => {
    const accion = vi.fn();
    render(<ActionMenu actions={[{ label: "Editar", onClick: accion }, { label: "Cancelar", onClick: accion, danger: true }]} />);
    const boton = screen.getByRole("button", { name: "Más acciones" });
    fireEvent.click(boton);
    expect(screen.getByRole("menuitem", { name: "Editar" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Cancelar" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(boton).toHaveFocus();
    expect(accion).not.toHaveBeenCalled();
  });
  it("no roba el foco al escribir en un diálogo que se vuelve a renderizar", () => {
    const cerrar = vi.fn();
    function Formulario() {
      const [valor, setValor] = useState("");
      return <Dialog title="Editar" onClose={() => cerrar()}><input aria-label="Detalle" value={valor} onChange={(event) => setValor(event.target.value)} /></Dialog>;
    }
    render(<Formulario />);
    const campo = screen.getByLabelText("Detalle");
    campo.focus();
    fireEvent.change(campo, { target: { value: "Nuevo" } });
    expect(campo).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(cerrar).toHaveBeenCalledTimes(1);
  });
  it("busca sin tildes y respeta el formato de teléfono", () => {
    expect(coincideBusqueda(["Sebastián", "Corte clásico"], "sebastian")).toBe(true);
    expect(validarTelefono("88887777")).toBe("");
    expect(validarTelefono("12345678")).not.toBe("");
    expect(validarNombre("   ")).not.toBe("");
  });
  it("activa Escape y bloqueo de scroll cuando un modal cerrado se abre", () => {
    const cerrar = vi.fn();
    const { rerender } = render(<ConfirmDialog config={null} onCancel={cerrar} />);
    rerender(<ConfirmDialog config={{ title: "¿Cancelar?", message: "Una prueba" }} onCancel={cerrar} />);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(cerrar).toHaveBeenCalledTimes(1);
    rerender(<ConfirmDialog config={null} onCancel={cerrar} />);
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
