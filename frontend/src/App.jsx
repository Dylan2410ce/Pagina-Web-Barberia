import { lazy, Suspense, useEffect, useState } from "react";
import PublicApp from "./PublicApp";

const AdminWorkspace = lazy(() => import("./components/admin/AdminWorkspace"));

export default function App() {
  const [ruta, setRuta] = useState(window.location.pathname);
  useEffect(() => {
    const actualizar = () => setRuta(window.location.pathname);
    window.addEventListener("popstate", actualizar);
    return () => window.removeEventListener("popstate", actualizar);
  }, []);
  if (!ruta.startsWith("/admin")) return <PublicApp />;
  return <Suspense fallback={<main className="admin-boot" role="status"><h1>Tu agenda</h1><span className="spinner" />Abriendo el panel…</main>}><AdminWorkspace /></Suspense>;
}
