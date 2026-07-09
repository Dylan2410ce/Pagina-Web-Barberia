import React from "react";
import { CalendarDays } from "lucide-react";
import { api, normalizeData } from "./lib/api";
import { useReveal } from "./hooks/useReveal";
import { AdminPanel } from "./components/AdminPanel";
import { Booking } from "./components/Booking";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { MapModal } from "./components/MapModal";
import { Navbar } from "./components/Navbar";
import { Services } from "./components/Services";

export default function App() {
  const [data, setData] = React.useState(null);
  const [mapOpen, setMapOpen] = React.useState(false);
  const [adminOpen, setAdminOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuServiceId, setMenuServiceId] = React.useState("");

  useReveal();

  React.useEffect(() => {
    api("/api/public/init")
      .then((response) => setData(normalizeData(response)))
      .catch(() => setData(false));
  }, []);

  function chooseMenuService(serviceId) {
    setMenuServiceId(serviceId);
    window.setTimeout(() => {
      document.getElementById("reservar")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);
  }

  if (data === null) {
    return (
      <main className="loading">
        <span className="spinner large" />
        <p>Cargando barberia...</p>
      </main>
    );
  }

  if (data === false) {
    return (
      <main className="loading">
        <p>No se pudo conectar con la API.</p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <Navbar
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onMap={() => setMapOpen(true)}
        onAdmin={() => setAdminOpen(true)}
      />

      <main id="top" className="page">
        <Hero data={data} onMap={() => setMapOpen(true)} onChooseService={chooseMenuService} />
        <Services data={data} onChooseService={chooseMenuService} />
        <Booking data={data} selectedServiceId={menuServiceId} />
      </main>

      <a className="mobile-cta" href="#reservar"><CalendarDays size={17} /> Reservar</a>
      <Footer location={data.location} onMap={() => setMapOpen(true)} />

      {mapOpen && <MapModal location={data.location} onClose={() => setMapOpen(false)} />}
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
    </div>
  );
}
