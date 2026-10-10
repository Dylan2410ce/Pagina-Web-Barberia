import { act, fireEvent, render, screen } from "@testing-library/react";
import AdminClients from "./AdminClients";

const cliente = {
  name: "Cliente de prueba", phone: "88887777", profile_id: "perfil-1",
  appointments: 1, completed_appointments: 1, spent: 6000, history: [],
};

it("distingue una búsqueda vacía de un directorio sin clientes", () => {
  render(<AdminClients clientes={[cliente]} />);
  expect(screen.getByText("1 cliente")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Buscar cliente" }), { target: { value: "sin resultados" } });
  expect(screen.getByText("Ningún cliente coincide con estos filtros.")).toBeInTheDocument();
  expect(screen.queryByText("Aún no hay clientes registrados.")).not.toBeInTheDocument();
});

it("evita enviar dos veces la misma ficha mientras se guarda", async () => {
  let completar;
  const onUpdate = vi.fn(() => new Promise((resolve) => { completar = resolve; }));
  render(<AdminClients clientes={[cliente]} onUpdate={onUpdate} />);
  const formulario = screen.getByRole("button", { name: "Guardar ficha" }).closest("form");
  fireEvent.submit(formulario);
  fireEvent.submit(formulario);
  expect(onUpdate).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
  await act(async () => completar(true));
  expect(screen.getByRole("button", { name: "Guardar ficha" })).toBeEnabled();
});

it("mantiene los datos y muestra el error de guardado en la ficha", async () => {
  const onUpdate = vi.fn().mockRejectedValue(new Error("La agenda no está disponible."));
  render(<AdminClients clientes={[cliente]} onUpdate={onUpdate} />);
  fireEvent.change(screen.getByLabelText("Preferencias del corte"), { target: { value: "Corte clásico" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar ficha" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("La agenda no está disponible.");
  expect(screen.getByLabelText("Preferencias del corte")).toHaveValue("Corte clásico");
});
