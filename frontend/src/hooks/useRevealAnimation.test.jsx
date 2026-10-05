import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useRevealAnimation from "./useRevealAnimation";

describe("Animaciones de contenido diferido", () => {
  it("observa elementos añadidos después del primer render y libera los observadores", async () => {
    const observar = vi.fn(); const desconectar = vi.fn(); const dejarDeObservar = vi.fn();
    let entradas;
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback) { entradas = callback; }
      observe = observar; disconnect = desconectar; unobserve = dejarDeObservar;
    });
    const { unmount } = renderHook(() => useRevealAnimation());
    const elemento = document.createElement("div"); elemento.className = "reveal";
    await act(async () => { document.body.append(elemento); });
    expect(observar).toHaveBeenCalledWith(elemento);
    entradas([{ isIntersecting: true, target: elemento }]);
    expect(elemento).toHaveClass("visible");
    expect(dejarDeObservar).toHaveBeenCalledWith(elemento);
    unmount(); elemento.remove(); vi.unstubAllGlobals();
    expect(desconectar).toHaveBeenCalled();
  });
});
