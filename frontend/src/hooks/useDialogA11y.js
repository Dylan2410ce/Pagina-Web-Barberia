import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export default function useDialogA11y(onClose) {
  const dialogRef = useRef(null);
  const cerrarRef = useRef(onClose);
  const abierto = Boolean(onClose);
  useEffect(() => { cerrarRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!abierto || !dialog) return undefined;
    const previous = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.querySelector(FOCUSABLE)?.focus();

    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        cerrarRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;
      const items = [...dialog.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
      document.body.style.overflow = originalOverflow;
      previous?.focus?.();
    };
  }, [abierto]);

  return dialogRef;
}
