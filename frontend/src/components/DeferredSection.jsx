import { useEffect, useRef, useState } from "react";

export default function DeferredSection({ children }) {
  const contenedor = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) { setVisible(true); return; }
    const observador = new IntersectionObserver(([entrada]) => {
      if (entrada.isIntersecting) { setVisible(true); observador.disconnect(); }
    }, { rootMargin: "300px" });
    observador.observe(contenedor.current);
    return () => observador.disconnect();
  }, []);
  return <div ref={contenedor} className="deferred-section">{visible ? children : <div className="section-placeholder" />}</div>;
}
