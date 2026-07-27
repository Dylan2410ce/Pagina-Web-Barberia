import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import useFormSectionVisible from "../hooks/useFormSectionVisible";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const formVisible = useFormSectionVisible();

  useEffect(() => {
    const actualizar = () => setVisible(window.scrollY > 560);
    actualizar();
    window.addEventListener("scroll", actualizar, { passive: true });
    return () => window.removeEventListener("scroll", actualizar);
  }, []);

  return (
    <button
      className={`scroll-top ${visible && !formVisible ? "visible" : ""}`}
      type="button"
      aria-label="Volver arriba"
      title="Volver arriba"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <ArrowUp size={20} />
    </button>
  );
}
