import React from "react";
import { createRoot } from "react-dom/client";
import { CalendarDays, Check, Lock, MapPin, Navigation, Scissors, X } from "lucide-react";
import { api, money, today } from "./lib/api";
import "./styles.css";

function App() {
  const [data, setData] = React.useState(null);
  const [mapOpen, setMapOpen] = React.useState(false);
  const [adminOpen, setAdminOpen] = React.useState(false);

  React.useEffect(() => {
    api("/api/public/init").then(setData).catch(() => setData(false));
  }, []);

  if (data === null) return <main className="loading">Cargando barberia...</main>;
  if (data === false) return <main className="loading">No se pudo conectar con la API.</main>;

  return (
    <>
      <header className="nav">
        <strong><Scissors size={18} /> Sebas Barber</strong>
        <div>
          <button onClick={() => setMapOpen(true)}><MapPin size={17} /> Ubicacion</button>
          <button onClick={() => setAdminOpen(true)}><Lock size={17} /> Admin</button>
        </div>
      </header>

      <main className="page">
        <section className="hero">
          <div className="hero-copy">
            <span>Studio Premium · Esparza</span>
            <h1>Cortes limpios, agenda simple.</h1>
            <p>Reserva tu espacio en segundos. Horarios reales, sin doble reserva y con panel administrativo para control diario.</p>
          </div>
          <img src="/barbero.jpeg" alt="Sebas Barber" />
        </section>

        <Booking data={data} />
      </main>

      <footer>
        <p>{data.location.address}</p>
        <button onClick={() => setMapOpen(true)}><Navigation size={16} /> Como llegar</button>
      </footer>

      {mapOpen && <MapModal location={data.location} onClose={() => setMapOpen(false)} />}
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
    </>
  );
}

function Booking({ data }) {
  const [form, setForm] = React.useState({
    barber_id: data.barbers[0]?.id || "",
    service_id: data.services[0]?.id || "",
    addon_ids: [],
    date: today(),
    start_min: "",
    client_name: "",
    client_phone: "",
  });
  const [slots, setSlots] = React.useState([]);
  const [message, setMessage] = React.useState("");

  const selectedService = data.services.find((item) => item.id === form.service_id);
  const selectedAddons = data.addons.filter((item) => form.addon_ids.includes(item.id));
  const total = (selectedService?.price || 0) + selectedAddons.reduce((sum, item) => sum + item.price, 0);

  React.useEffect(() => {
    if (!form.barber_id || !form.service_id || !form.date) return;
    const params = new URLSearchParams({
      barber_id: form.barber_id,
      service_id: form.service_id,
      date: form.date,
    });
    form.addon_ids.forEach((id) => params.append("addon_ids", id));
    api(`/api/public/availability?${params}`)
      .then((items) => {
        setSlots(items);
        setForm((current) => ({ ...current, start_min: "" }));
      })
      .catch(() => setSlots([]));
  }, [form.barber_id, form.service_id, form.date, form.addon_ids.join(",")]);

  function toggleAddon(id) {
    setForm((current) => ({
      ...current,
      addon_ids: current.addon_ids.includes(id)
        ? current.addon_ids.filter((item) => item !== id)
        : [...current.addon_ids, id],
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setMessage("Guardando cita...");
    try {
      await api("/api/public/appointments", {
        method: "POST",
        body: JSON.stringify({ ...form, start_min: Number(form.start_min) }),
      });
      setMessage("Cita confirmada. Te esperamos.");
      setForm((current) => ({ ...current, start_min: "", client_name: "", client_phone: "" }));
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="booking-card">
      <h2><CalendarDays /> Reservar cita</h2>
      <form onSubmit={submit}>
        <label>Barbero</label>
        <div className="option-grid">
          {data.barbers.map((barber) => (
            <button type="button" className={form.barber_id === barber.id ? "active" : ""} onClick={() => setForm({ ...form, barber_id: barber.id })} key={barber.id}>
              <b>{barber.name}</b>
              <small>{barber.role}</small>
            </button>
          ))}
        </div>

        <label>Servicio</label>
        <select value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })}>
          {data.services.map((service) => (
            <option value={service.id} key={service.id}>
              {service.name} · {service.duration_min} min · {money(service.price)}
            </option>
          ))}
        </select>

        <label>Extras</label>
        <div className="pill-grid">
          {data.addons.map((addon) => (
            <button type="button" className={form.addon_ids.includes(addon.id) ? "active" : ""} onClick={() => toggleAddon(addon.id)} key={addon.id}>
              {addon.name} · {money(addon.price)}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <div>
            <label>Fecha</label>
            <input type="date" min={today()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label>Hora</label>
            <select value={form.start_min} onChange={(e) => setForm({ ...form, start_min: e.target.value })} required>
              <option value="">Selecciona</option>
              {slots.map((slot) => <option value={slot.start_min} key={slot.start_min}>{slot.label}</option>)}
            </select>
          </div>
        </div>

        <div className="form-grid">
          <input placeholder="Nombre completo" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} required />
          <input placeholder="Telefono: 88887777" value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} required />
        </div>

        <div className="resume">
          <strong>Total: {money(total)}</strong>
          <button><Check size={18} /> Confirmar</button>
        </div>
        {message && <p className="message">{message}</p>}
      </form>
    </section>
  );
}

function AdminPanel({ onClose }) {
  const [token, setToken] = React.useState(localStorage.getItem("token") || "");
  const [login, setLogin] = React.useState({ username: "sebas", password: "" });
  const [date, setDate] = React.useState(today());
  const [rows, setRows] = React.useState([]);
  const [stats, setStats] = React.useState(null);
  const [block, setBlock] = React.useState({ start_min: 480, duration_min: 45, notes: "" });

  React.useEffect(() => {
    if (token) load();
  }, [token, date]);

  async function submitLogin(event) {
    event.preventDefault();
    const response = await api("/api/admin/login", { method: "POST", body: JSON.stringify(login) });
    localStorage.setItem("token", response.token);
    setToken(response.token);
  }

  async function load() {
    const now = new Date();
    const [appointments, report] = await Promise.all([
      api(`/api/admin/appointments?date=${date}`, { token }),
      api(`/api/admin/stats?year=${now.getFullYear()}&month=${now.getMonth() + 1}`, { token }),
    ]);
    setRows(appointments);
    setStats(report);
  }

  async function changeStatus(id, status) {
    await api(`/api/admin/appointments/${id}/status?status=${status}`, { method: "PATCH", token });
    load();
  }

  async function createBlock(event) {
    event.preventDefault();
    await api("/api/admin/blocks", {
      method: "POST",
      token,
      body: JSON.stringify({ ...block, date, start_min: Number(block.start_min), duration_min: Number(block.duration_min) }),
    });
    setBlock({ start_min: 480, duration_min: 45, notes: "" });
    load();
  }

  return (
    <div className="overlay">
      <section className="modal admin">
        <button className="close" onClick={onClose}><X /></button>
        {!token ? (
          <form className="login" onSubmit={submitLogin}>
            <h2>Panel admin</h2>
            <input placeholder="Usuario" value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} />
            <input type="password" placeholder="Password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
            <button>Entrar</button>
          </form>
        ) : (
          <>
            <h2>Agenda del dia</h2>
            <div className="stats">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <strong>{stats?.appointments || 0} citas</strong>
              <strong>{stats?.attended || 0} asistencias</strong>
              <strong>{money(stats?.income || 0)}</strong>
            </div>

            <form className="block-form" onSubmit={createBlock}>
              <select value={block.start_min} onChange={(e) => setBlock({ ...block, start_min: e.target.value })}>
                {Array.from({ length: 15 }, (_, i) => 480 + i * 45).map((value) => <option value={value} key={value}>{Math.floor(value / 60)}:{String(value % 60).padStart(2, "0")}</option>)}
              </select>
              <select value={block.duration_min} onChange={(e) => setBlock({ ...block, duration_min: e.target.value })}>
                {[45, 60, 90, 120, 180].map((value) => <option value={value} key={value}>{value} min</option>)}
              </select>
              <input placeholder="Nota del bloqueo" value={block.notes} onChange={(e) => setBlock({ ...block, notes: e.target.value })} />
              <button>Bloquear</button>
            </form>

            <div className="appointments">
              {rows.map((item) => (
                <article key={item.id}>
                  <div>
                    <b>{item.client_name}</b>
                    <span>{item.service_name} · {money(item.total_price)}</span>
                    <small>{new Date(item.starts_at).toLocaleString("es-CR")} · {item.status}</small>
                  </div>
                  <nav>
                    <button onClick={() => changeStatus(item.id, "present")}>Asistio</button>
                    <button onClick={() => changeStatus(item.id, "noshow")}>No vino</button>
                    <button onClick={() => changeStatus(item.id, "cancelled")}>Cancelar</button>
                  </nav>
                </article>
              ))}
              {!rows.length && <p className="empty">No hay citas para esta fecha.</p>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function MapModal({ location, onClose }) {
  return (
    <div className="overlay">
      <section className="modal">
        <button className="close" onClick={onClose}><X /></button>
        <h2>Ubicacion</h2>
        <p>{location.address}</p>
        <iframe title="Mapa" src={`https://maps.google.com/maps?q=${location.lat},${location.lng}&z=16&output=embed`} />
        <div className="map-actions">
          <a href={location.googleMapsUrl} target="_blank">Google Maps</a>
          <a href={location.wazeUrl} target="_blank"><Navigation size={16} /> Waze</a>
        </div>
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);

