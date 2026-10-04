import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import useFormSectionVisible from "../hooks/useFormSectionVisible";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const formVisible = useFormSectionVisible();

  useEffect(() => {
    const actualizar = () => {
      const firma = document.querySelector(".site-footer-signature")?.getBoundingClientRect();
      const firmaVisible = firma && firma.top < window.innerHeight && firma.bottom > 0;
      setVisible(window.scrollY > 560 && !firmaVisible);
    };
    actualizar();
    window.addEventListener("scroll", actualizar, { passive: true });
    window.addEventListener("resize", actualizar);
    return () => {
      window.removeEventListener("scroll", actualizar);
      window.removeEventListener("resize", actualizar);
    };
  }, []);

  return (
    <button
      className={`scroll-top ${visible && !formVisible ? "visible" : ""}`}
      type="button"
      aria-label="Volver arriba"
      title="Volver arriba"
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
    >
      <ArrowUp size={20} aria-hidden="true" />
      <span>Subir</span>
    </button>
  );
}
