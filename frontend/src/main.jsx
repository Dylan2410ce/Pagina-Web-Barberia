import React from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays,
  Check,
  Clock3,
  Lock,
  MapPin,
  Navigation,
  Scissors,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { api, money, today } from "./lib/api";
import "./styles.css";

const statusLabels = {
  booked: "Reservada",
  present: "Asistio",
  noshow: "No vino",
  cancelled: "Cancelada",
  blocked: "Bloqueo",
};

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
        <a className="brand" href="#top"><Scissors size={18} /> Sebas Barber</a>
        <nav>
          <button type="button" onClick={() => setMapOpen(true)}><MapPin size={17} /> Ubicacion</button>
          <button type="button" onClick={() => setAdminOpen(true)}><Lock size={17} /> Admin</button>
        </nav>
      </header>

      <main id="top" className="page">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">Studio Premium / Esparza</span>
            <h1>Tu corte, tu hora, cero vueltas.</h1>
            <p>Agenda rapida para cortes frescos, horarios reales y una experiencia limpia desde el celular.</p>
            <div className="hero-actions">
              <a href="#reservar"><CalendarDays size={18} /> Reservar ahora</a>
              <button type="button" onClick={() => setMapOpen(true)}><Navigation size={18} /> Como llegar</button>
            </div>
          </div>

          <div className="hero-media">
            <img src="/barbero.jpeg" alt="Sebas Barber" />
            <div className="hero-badge">
              <Sparkles size={17} />
              <span>Fade, clasico, barba y color</span>
            </div>
          </div>
        </section>

        <Booking data={data} />
      </main>

      <footer>
        <p>{data.location.address}</p>
        <button type="button" onClick={() => setMapOpen(true)}><Navigation size={16} /> Abrir rutas</button>
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
  const [slotsLoading, setSlotsLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const selectedBarber = data.barbers.find((item) => item.id === form.barber_id);
  const selectedService = data.services.find((item) => item.id === form.service_id);
  const selectedAddons = data.addons.filter((item) => form.addon_ids.includes(item.id));
  const duration = (selectedService?.duration_min || 0) + selectedAddons.reduce((sum, item) => sum + item.duration_min, 0);
  const total = (selectedService?.price || 0) + selectedAddons.reduce((sum, item) => sum + item.price, 0);
  const selectedSlot = slots.find((slot) => String(slot.start_min) === String(form.start_min));
  const canSubmit = form.barber_id && form.service_id && form.date && form.start_min && form.client_name && form.client_phone && !saving;

  const loadSlots = React.useCallback(async () => {
    if (!form.barber_id || !form.service_id || !form.date) return;
    setSlotsLoading(true);
    const params = new URLSearchParams({
      barber_id: form.barber_id,
      service_id: form.service_id,
      date: form.date,
    });
    form.addon_ids.forEach((id) => params.append("addon_ids", id));

    try {
      const items = await api(`/api/public/availability?${params}`);
      setSlots(items);
      setForm((current) => (
        items.some((slot) => String(slot.start_min) === String(current.start_min))
          ? current
          : { ...current, start_min: "" }
      ));
    } catch {
      setSlots([]);
      setForm((current) => ({ ...current, start_min: "" }));
    } finally {
      setSlotsLoading(false);
    }
  }, [form.barber_id, form.service_id, form.date, form.addon_ids.join(",")]);

  React.useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  function toggleAddon(id) {
    setMessage("");
    setForm((current) => ({
      ...current,
      addon_ids: current.addon_ids.includes(id)
        ? current.addon_ids.filter((item) => item !== id)
        : [...current.addon_ids, id],
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setMessage("Guardando tu cita...");
    try {
      await api("/api/public/appointments", {
        method: "POST",
        body: JSON.stringify({ ...form, start_min: Number(form.start_min) }),
      });
      setMessage("Listo. Tu cita quedo reservada.");
      setForm((current) => ({ ...current, start_min: "", client_name: "", client_phone: "" }));
      await loadSlots();
    } catch (error) {
      setMessage(error.message || "Ese horario acaba de ser tomado.");
      await loadSlots();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="reservar" className="booking-shell">
      <div className="booking-card">
        <div className="section-title">
          <span><CalendarDays size={18} /> Reserva</span>
          <h2>Elige barbero, servicio y hora.</h2>
        </div>

        <form onSubmit={submit}>
          <label>Barbero</label>
          <div className="barber-grid">
            {data.barbers.map((barber) => (
              <button
                type="button"
                className={form.barber_id === barber.id ? "barber-card active" : "barber-card"}
                onClick={() => {
                  setMessage("");
                  setForm({ ...form, barber_id: barber.id, start_min: "" });
                }}
                key={barber.id}
              >
                <span className="avatar">{barber.name.slice(0, 1)}</span>
                <b>{barber.name}</b>
                <small>{barber.role}</small>
              </button>
            ))}
          </div>

          <label>Servicio</label>
          <div className="service-grid">
            {data.services.map((service) => (
              <button
                type="button"
                className={form.service_id === service.id ? "service-card active" : "service-card"}
                onClick={() => {
                  setMessage("");
                  setForm({ ...form, service_id: service.id, start_min: "" });
                }}
                key={service.id}
              >
                <span>{service.name}</span>
                <small>{service.duration_min} min</small>
                <strong>{money(service.price)}</strong>
              </button>
            ))}
          </div>

          <label>Extras</label>
          <div className="pill-grid">
            {data.addons.map((addon) => (
              <button
                type="button"
                className={form.addon_ids.includes(addon.id) ? "active" : ""}
                onClick={() => toggleAddon(addon.id)}
                key={addon.id}
              >
                {addon.name} <small>{money(addon.price)}</small>
              </button>
            ))}
          </div>

          <div className="form-grid">
            <div>
              <label>Fecha</label>
              <input
                type="date"
                min={today()}
                value={form.date}
                onChange={(event) => {
                  setMessage("");
                  setForm({ ...form, date: event.target.value, start_min: "" });
                }}
              />
            </div>
            <div>
              <label>Cliente</label>
              <input
                placeholder="Nombre completo"
                value={form.client_name}
                onChange={(event) => setForm({ ...form, client_name: event.target.value })}
                required
              />
            </div>
          </div>

          <label>Hora disponible</label>
          <div className="slots-grid">
            {slotsLoading && <span className="slot-note">Buscando espacios...</span>}
            {!slotsLoading && slots.map((slot) => (
              <button
                type="button"
                className={String(form.start_min) === String(slot.start_min) ? "active" : ""}
                onClick={() => {
                  setMessage("");
                  setForm({ ...form, start_min: slot.start_min });
                }}
                key={slot.start_min}
              >
                <Clock3 size={15} /> {slot.label}
              </button>
            ))}
            {!slotsLoading && slots.length === 0 && (
              <span className="slot-note">No hay espacios para esa fecha.</span>
            )}
          </div>

          <div className="form-grid">
            <input
              placeholder="Telefono: 88887777"
              value={form.client_phone}
              onChange={(event) => setForm({ ...form, client_phone: event.target.value })}
              required
            />
            <button className="submit-btn" disabled={!canSubmit}>
              <Check size={18} /> {saving ? "Reservando..." : "Confirmar cita"}
            </button>
          </div>

          {message && <p className={message.includes("Listo") ? "message success" : "message"}>{message}</p>}
        </form>
      </div>

      <aside className="summary-card">
        <span className="eyebrow">Resumen</span>
        <h3>{selectedService?.name || "Selecciona servicio"}</h3>
        <div className="summary-list">
          <p><UserRound size={16} /> {selectedBarber?.name || "Barbero"}</p>
          <p><CalendarDays size={16} /> {form.date || "Fecha"} {selectedSlot ? `/ ${selectedSlot.label}` : ""}</p>
          <p><Clock3 size={16} /> {duration || 0} min</p>
        </div>
        <div className="total-line">
          <span>Total</span>
          <strong>{money(total)}</strong>
        </div>
        <small>Los horarios reservados desaparecen automaticamente para otros clientes.</small>
      </aside>
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
  const [adminMsg, setAdminMsg] = React.useState("");

  React.useEffect(() => {
    if (token) load();
  }, [token, date]);

  async function submitLogin(event) {
    event.preventDefault();
    setAdminMsg("");
    try {
      const response = await api("/api/admin/login", { method: "POST", body: JSON.stringify(login) });
      localStorage.setItem("token", response.token);
      setToken(response.token);
    } catch (error) {
      setAdminMsg(error.message);
    }
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

  function logout() {
    localStorage.removeItem("token");
    setToken("");
  }

  return (
    <div className="overlay">
      <section className="modal admin">
        <button className="close" onClick={onClose}><X /></button>
        {!token ? (
          <form className="login" onSubmit={submitLogin}>
            <span className="eyebrow">Privado</span>
            <h2>Panel admin</h2>
            <input placeholder="Usuario" value={login.username} onChange={(event) => setLogin({ ...login, username: event.target.value })} />
            <input type="password" placeholder="Password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} />
            <button>Entrar</button>
            {adminMsg && <p className="message">{adminMsg}</p>}
          </form>
        ) : (
          <>
            <div className="admin-head">
              <div>
                <span className="eyebrow">Control diario</span>
                <h2>Agenda</h2>
              </div>
              <button type="button" onClick={logout}>Salir</button>
            </div>

            <div className="stats">
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              <strong>{stats?.appointments || 0}<small>citas</small></strong>
              <strong>{stats?.attended || 0}<small>asistencias</small></strong>
              <strong>{money(stats?.income || 0)}<small>mes</small></strong>
            </div>

            <form className="block-form" onSubmit={createBlock}>
              <select value={block.start_min} onChange={(event) => setBlock({ ...block, start_min: event.target.value })}>
                {Array.from({ length: 15 }, (_, index) => 480 + index * 45).map((value) => (
                  <option value={value} key={value}>{Math.floor(value / 60)}:{String(value % 60).padStart(2, "0")}</option>
                ))}
              </select>
              <select value={block.duration_min} onChange={(event) => setBlock({ ...block, duration_min: event.target.value })}>
                {[45, 60, 90, 120, 180].map((value) => <option value={value} key={value}>{value} min</option>)}
              </select>
              <input placeholder="Nota del bloqueo" value={block.notes} onChange={(event) => setBlock({ ...block, notes: event.target.value })} />
              <button>Bloquear</button>
            </form>

            <div className="appointments">
              {rows.map((item) => (
                <article className={item.status} key={item.id}>
                  <time>{new Date(item.starts_at).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}</time>
                  <div>
                    <b>{item.client_name}</b>
                    <span>{item.service_name} / {money(item.total_price)}</span>
                    <small>{statusLabels[item.status] || item.status}</small>
                  </div>
                  <nav>
                    <button type="button" onClick={() => changeStatus(item.id, "present")}>Asistio</button>
                    <button type="button" onClick={() => changeStatus(item.id, "noshow")}>No vino</button>
                    <button type="button" onClick={() => changeStatus(item.id, "cancelled")}>Cancelar</button>
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
        <span className="eyebrow">Ubicacion</span>
        <h2>{location.name}</h2>
        <p className="muted">{location.address}</p>
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
