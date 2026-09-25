import { useEffect, useState } from "react";

const FORM_SECTION_IDS = ["reserva", "mis-citas"];

export default function useFormSectionVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return undefined;
    let sections = [];
    const visibleSections = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visibleSections.add(entry.target.id);
          else visibleSections.delete(entry.target.id);
        });
        setVisible(visibleSections.size > 0);
      },
      { rootMargin: "-8% 0px -8% 0px", threshold: 0 },
    );

    const observar = () => {
      const siguientes = FORM_SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean);
      if (siguientes.length === sections.length && siguientes.every((item, index) => item === sections[index])) return;
      observer.disconnect();
      visibleSections.clear();
      sections = siguientes;
      sections.forEach((section) => observer.observe(section));
    };
    observar();
    const cambios = new MutationObserver(observar);
    cambios.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); cambios.disconnect(); };
  }, []);

  return visible;
}
