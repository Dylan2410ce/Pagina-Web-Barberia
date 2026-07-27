import { useEffect, useState } from "react";

const FORM_SECTION_IDS = ["reserva", "mis-citas"];

export default function useFormSectionVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sections = FORM_SECTION_IDS
      .map((id) => document.getElementById(id))
      .filter(Boolean);
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

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return visible;
}
