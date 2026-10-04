// Datos ficticios para probar la interfaz sin contactar servicios externos.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import BookingWizard from "../src/components/BookingWizard";
import ServiceMenu from "../src/components/ServiceMenu";
import { nuevaReserva } from "../src/utils/bookingDraft";
import { hoyISO } from "../src/utils/format";
import "../src/styles.css";

const servicios = [{ id: "s1", name: "Corte de cabello", duration_min: 45, price: 5000 }, { id: "s2", name: "Corte Premium", duration_min: 45, price: 6000 }];
const barberos = [{ id: "b1", name: "Sebastián", role: "Barbero" }, { id: "b2", name: "Gabriel", role: "Barbero" }];
function Vista() {
  const [reserva, setReserva] = useState(nuevaReserva);
  const [paso, setPaso] = useState(null);
  const [error, setError] = useState("");
  const servicio = servicios.find((item) => item.id === reserva.service_id);
  const barbero = barberos.find((item) => item.id === reserva.barber_id);
  const cambiar = (campo, valor) => setReserva((prev) => ({ ...prev, [campo]: valor, start_min: null }));
  return <main>
    <style>{".reveal { opacity: 1; transform: none; }"}</style>
    <div style={{ padding: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}><strong>Vista de prueba local</strong><button type="button" className="btn btn-linea" onClick={() => setError("No hay conexión con la agenda.")}>Simular error</button></div>
    <ServiceMenu servicios={servicios} extras={[]} onSeleccionar={(id) => { cambiar("service_id", id); setPaso({ step: 1, key: Date.now() }); document.getElementById("reserva")?.scrollIntoView(); }} />
    <BookingWizard reserva={reserva} setReserva={setReserva} resumen={{ servicio, duracion: 45, total: servicio?.price || 0, extras: [], hora: reserva.start_min === 480 ? "8:00 a. m." : "8:45 a. m." }} servicios={servicios} extras={[]} barberos={barberos} barbero={barbero} minFecha={hoyISO()} slots={error ? [] : [{ start_min: 480, label: "8:00 a. m." }, { start_min: 525, label: "8:45 a. m." }]} errorSlots={error} onReintentar={() => setError("")} onServicio={(id) => cambiar("service_id", id)} onBarbero={(id) => cambiar("barber_id", id)} onFecha={(date) => cambiar("date", date)} onSubmit={(event) => event.preventDefault()} pasoSolicitado={paso} />
  </main>;
}
if (import.meta.env.DEV) createRoot(document.getElementById("root")).render(<Vista />);
