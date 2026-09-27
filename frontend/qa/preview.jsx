// Entorno visual con datos ficticios. No forma parte de la entrada de producción.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import AdminPanel from "../src/components/AdminPanel";
import Toasts from "../src/components/Toasts";
import "../src/styles.css";

const servicios = [{ id: "s1", name: "Corte Premium", price: 6000, duration_min: 45, is_active: true }, { id: "s2", name: "Barba completa", price: 3000, duration_min: 45, is_active: true }];
const citas = Array.from({ length: 9 }, (_, i) => ({ id: `qa-${i}`, starts_at: `2026-09-29T${String(8 + i).padStart(2, "0")}:00:00-06:00`, client_name: `Cliente de prueba ${i + 1}`, client_phone: "88887777", service_name: servicios[i % 2].name, total_price: servicios[i % 2].price, status: i % 2 ? "pending" : "confirmed", addons: [] }));
const base = { token: "qa-local-no-valido", tab: "resumen", perfil: { name: "Sebastián", role: "Barbero" }, filtros: { date: "2026-09-29", status: "", q: "" }, citas, servicios, bloqueos: [], horarios: [], clientes: [{ name: "Cliente de prueba", phone: "88887777", appointments: 4, completed_appointments: 3, spent: 18000, last_visit: citas[0].starts_at, favorite_service: "Corte Premium", history: citas.map((item) => ({ ...item, service: item.service_name })) }], ausencias: [], listaEspera: [], reseñas: [], galeria: [], actividad: [], operaciones: {}, stats: { income: 168000, average_ticket: 6000 }, dashboard: { appointments_today: 9, pending_today: 7, completed_today: 2, appointments_week: 28, completed_week: 21, income_week: 126000, top_service_week: "Corte Premium", income_today: 12000, projected_today: 45000, upcoming: citas } };
function Vista() {
  const [admin, setAdmin] = useState(base);
  const [avisos, setAvisos] = useState([]);
  const avisar = async () => { setAvisos([{ id: "qa", tipo: "ok", titulo: "Acción de prueba completada" }]); return true; };
  return <><AdminPanel admin={admin} onTab={(tab) => setAdmin((actual) => ({ ...actual, tab }))} onSalir={() => setAdmin({ ...base, token: "" })} onLogin={async () => setAdmin(base)} onResetPassword={avisar} onBloqueoRapido={avisar} onFiltrar={(filtros) => setAdmin((actual) => ({ ...actual, filtros }))} onEstado={avisar} onMover={avisar} onGuardarServicio={async (event) => { event.preventDefault(); return avisar(); }} onChangePassword={avisar} /><Toasts items={avisos} onClose={() => setAvisos([])} /></>;
}
if (import.meta.env.DEV) createRoot(document.getElementById("root")).render(<Vista />);
