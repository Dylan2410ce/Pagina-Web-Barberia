import React from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  Check,
  Clock3,
  Flame,
  Lock,
  Menu,
  MapPin,
  Navigation,
  Palette,
  Scissors,
  Sparkles,
  Star,
  TrendingUp,
  UserRound,
  Zap,
  X,
} from "lucide-react";
import { api, cleanPhone, money, normalizeData, today } from "./lib/api";
import "./styles.css";

const statusLabels = {
  booked: "Reservada",
  present: "Asistio",
  noshow: "No vino",
  cancelled: "Cancelada",
  blocked: "Bloqueo",
};

const serviceMoods = [
  "Fresh",
  "Clean",
  "Sharp",
  "Color",
  "Glow",
];

const themes = [
  { id: "sunset", name: "Coral", note: "casual" },
  { id: "lime", name: "Mint", note: "clean" },
  { id: "violet", name: "Neon", note: "bold" },
];

function isClosedDay(dateValue) {
  if (!dateValue) return false;
  const day = new Date(`${dateValue}T12:00:00`).getDay();
  return day === 0 || day === 1;
}

function hourFromMinutes(value) {
  return `${Math.floor(Number(value) / 60)}:${String(Number(value) % 60).padStart(2, "0")}`;
}

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function App() {
  const [data, setData] = React.useState(null);
  const [mapOpen, setMapOpen] = React.useState(false);
  const [adminOpen, setAdminOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuServiceId, setMenuServiceId] = React.useState("");
  const [theme, setTheme] = React.useState(() => localStorage.getItem("sb_theme") || "sunset");

  React.useEffect(() => {
    api("/api/public/init").then((response) => setData(normalizeData(response))).catch(() => setData(false));
  }, []);

  React.useEffect(() => {
    localStorage.setItem("sb_theme", theme);
  }, [theme]);

  function chooseMenuService(serviceId) {
    setMenuServiceId(serviceId);
    window.setTimeout(() => {
      document.getElementById("reservar")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);
  }

  if (data === null) return <main className="loading">Cargando barberia...</main>;
  if (data === false) return <main className="loading">No se pudo conectar con la API.</main>;

  return (
    <div className={`app-shell theme-${theme}`}>
      <header className="nav">
        <div className="nav-top">
          <a className="brand" href="#top" onClick={() => setMenuOpen(false)}><Scissors size={18} /> Sebas Barber</a>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-label="Abrir menu"
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
            <span>Menu</span>
          </button>
        </div>
        <nav className={menuOpen ? "nav-links open" : "nav-links"}>
          <a href="#servicios" onClick={() => setMenuOpen(false)}>Servicios</a>
          <a href="#reservar" onClick={() => setMenuOpen(false)}>Reservar</a>
          <button type="button" onClick={() => { setMapOpen(true); setMenuOpen(false); }}><MapPin size={17} /> Ubicacion</button>
          <button type="button" onClick={() => { setAdminOpen(true); setMenuOpen(false); }}><Lock size={17} /> Admin</button>
        </nav>
      </header>

      <main id="top" className="page">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">Sebas Barber / Esparza</span>
            <h1>Reserva tu flow en minutos.</h1>
            <p>Cortes fresh, horarios reales y una agenda sin enredos para que llegues, te sientes y salgas listo.</p>
            <div className="hero-actions">
              <a href="#reservar"><CalendarDays size={18} /> Reservar ahora</a>
              <button type="button" onClick={() => setMapOpen(true)}><Navigation size={18} /> Como llegar</button>
            </div>
            <ThemePicker value={theme} onChange={setTheme} />
          </div>

          <div className="hero-media">
            <img src="/barbero.jpeg" alt="Sebas Barber" />
            <div className="hero-badge">
              <Sparkles size={17} />
              <span>Fade, clasico, barba, color y detalles</span>
            </div>
          </div>
        </section>

        <HomeShowcase data={data} onChooseService={chooseMenuService} />
        <Booking data={data} selectedServiceId={menuServiceId} />
      </main>

      <a className="mobile-cta" href="#reservar"><CalendarDays size={17} /> Reservar</a>

      <footer>
        <p>{data.location.address}</p>
        <button type="button" onClick={() => setMapOpen(true)}><Navigation size={16} /> Abrir rutas</button>
      </footer>

      {mapOpen && <MapModal location={data.location} onClose={() => setMapOpen(false)} />}
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
    </div>
  );
}

function ThemePicker({ value, onChange }) {
  return (
    <div className="theme-picker" aria-label="Cambiar paleta visual">
      <span><Palette size={16} /> Mood</span>
      {themes.map((item) => (
        <button
          type="button"
          className={value === item.id ? "active" : ""}
          onClick={() => onChange(item.id)}
          key={item.id}
        >
          {item.name}
          <small>{item.note}</small>
        </button>
      ))}
    </div>
  );
}

function HomeShowcase({ data, onChooseService }) {
  const [activeService, setActiveService] = React.useState(data.services[0]?.id || "");
  const service = data.services.find((item) => item.id === activeService) || data.services[0];
  const minPrice = Math.min(...data.services.map((item) => item.price));
  const maxPrice = Math.max(...data.services.map((item) => item.price));

  return (
    <section id="servicios" className="showcase">
      <div className="metric-strip">
        <article>
          <Flame size={20} />
          <strong>{data.services.length}</strong>
          <span>servicios</span>
        </article>
        <article>
          <CalendarCheck size={20} />
          <strong>8-7</strong>
          <span>martes a sabado</span>
        </article>
        <article>
          <Sparkles size={20} />
          <strong>{money(minPrice)}</strong>
          <span>desde</span>
        </article>
      </div>

      <div className="menu-board">
        <div className="menu-board-head">
          <div>
            <span className="eyebrow">Menu de barberia</span>
            <h2>Precios claros, reserva rapida.</h2>
            <p>Escoge el servicio desde el menu y la reserva baja lista con tu eleccion.</p>
          </div>
          <div className="menu-range">
            <small>rango</small>
            <strong>{money(minPrice)} - {money(maxPrice)}</strong>
          </div>
        </div>

        <div className="price-menu-layout">
          <div className="price-menu-main">
            <div className="menu-category">
              <span><Scissors size={17} /> Cortes y barba</span>
              <small>Tarifas finales con el aumento incluido.</small>
            </div>
            <div className="price-menu-grid">
              {data.services.map((item) => (
                <article
                  className={item.id === service?.id ? "price-item active" : "price-item"}
                  onMouseEnter={() => setActiveService(item.id)}
                  onFocus={() => setActiveService(item.id)}
                  key={item.id}
                >
                  <button type="button" className="price-item-main" onClick={() => setActiveService(item.id)}>
                    <span>{item.name}</span>
                    <small>{item.duration_min} min / {item.duration_min > 60 ? "look completo" : "servicio express"}</small>
                  </button>
                  <strong>{money(item.price)}</strong>
                  <button type="button" className="pick-service" onClick={() => onChooseService(item.id)}>
                    Elegir
                  </button>
                </article>
              ))}
            </div>
          </div>

          <aside className="menu-preview">
            <div className="preview-mark">
              <Sparkles size={22} />
            </div>
            <span className="eyebrow">Seleccionado</span>
            <h3>{service?.name}</h3>
            <p>{service?.duration_min} minutos / {money(service?.price)}</p>
            <div className="mood-row">
              {serviceMoods.map((mood) => <span key={mood}>{mood}</span>)}
            </div>
            <div className="service-energy">
              <Zap size={17} />
              <b>Ideal para</b>
              <span>{service?.duration_min > 60 ? "cambio de look o produccion" : "refresh semanal y salida casual"}</span>
            </div>
            <button type="button" onClick={() => onChooseService(service?.id)}>
              Reservar este servicio
            </button>
          </aside>
        </div>

        {!!data.addons.length && (
          <div className="addon-menu">
            <div className="menu-category">
              <span><Sparkles size={17} /> Extras</span>
              <small>Se suman al tiempo y precio final.</small>
            </div>
            <div className="addon-menu-grid">
              {data.addons.map((addon) => (
                <article key={addon.id}>
                  <span>{addon.name}</span>
                  <small>{addon.duration_min} min</small>
                  <b>{money(addon.price)}</b>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="barber-showcase">
        {data.barbers.map((barber) => (
          <article key={barber.id}>
            <span>{barber.name.slice(0, 1)}</span>
            <h3>{barber.name}</h3>
            <p>{barber.role}</p>
            <small><Star size={14} /> Agenda activa</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function Booking({ data, selectedServiceId }) {
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
  const [errors, setErrors] = React.useState({});

  const selectedBarber = data.barbers.find((item) => item.id === form.barber_id);
  const selectedService = data.services.find((item) => item.id === form.service_id);
  const selectedAddons = data.addons.filter((item) => form.addon_ids.includes(item.id));
  const duration = (selectedService?.duration_min || 0) + selectedAddons.reduce((sum, item) => sum + item.duration_min, 0);
  const total = (selectedService?.price || 0) + selectedAddons.reduce((sum, item) => sum + item.price, 0);
  const selectedSlot = slots.find((slot) => String(slot.start_min) === String(form.start_min));
  const phoneValid = /^[24678][0-9]{7}$/.test(form.client_phone);
  const nameValid = /^[\p{L}\s]{3,60}$/u.test(form.client_name.trim());
  const closedSelectedDate = isClosedDay(form.date);
  const canSubmit = form.barber_id && form.service_id && form.date && form.start_min && form.client_name && form.client_phone && !closedSelectedDate && !saving;
  const progress = [
    Boolean(form.barber_id),
    Boolean(form.service_id),
    Boolean(form.date && form.start_min && !closedSelectedDate),
    Boolean(nameValid && phoneValid),
  ].filter(Boolean).length;

  const loadSlots = React.useCallback(async () => {
    if (!form.barber_id || !form.service_id || !form.date) return;
    if (isClosedDay(form.date)) {
      setSlotsLoading(false);
      setSlots([]);
      setForm((current) => ({ ...current, start_min: "" }));
      return;
    }
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
    if (!selectedServiceId || selectedServiceId === form.service_id) return;
    const exists = data.services.some((item) => item.id === selectedServiceId);
    if (!exists) return;
    setMessage("Servicio seleccionado desde el menu.");
    setErrors({});
    setForm((current) => ({ ...current, service_id: selectedServiceId, start_min: "" }));
  }, [selectedServiceId, data.services, form.service_id]);

  React.useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  React.useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") loadSlots();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", loadSlots);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", loadSlots);
    };
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
    const nextErrors = {};
    if (!nameValid) nextErrors.client_name = "Escribe un nombre real, minimo 3 letras.";
    if (!phoneValid) nextErrors.client_phone = "Usa un numero de Costa Rica de 8 digitos.";
    if (!form.start_min) nextErrors.start_min = "Selecciona una hora disponible.";
    if (closedSelectedDate) nextErrors.start_min = "Domingo y lunes permanecemos cerrados.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("Revisa los datos marcados antes de confirmar.");
      return;
    }

    setSaving(true);
    setMessage("Guardando tu cita...");
    try {
      await api("/api/public/appointments", {
        method: "POST",
        body: JSON.stringify({ ...form, start_min: Number(form.start_min) }),
      });
      setMessage("Listo. Tu cita quedo reservada.");
      setSlots((current) => current.filter((slot) => String(slot.start_min) !== String(form.start_min)));
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
          <h2>Escoge tu barbero, servicio y hora.</h2>
        </div>
        <div className="booking-progress" style={{ "--progress": `${progress * 25}%` }}>
          <span>{progress}/4 listo</span>
          <b />
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
                onChange={(event) => {
                  setErrors({ ...errors, client_name: "" });
                  setForm({ ...form, client_name: event.target.value });
                }}
                required
              />
              {errors.client_name && <small className="field-error">{errors.client_name}</small>}
            </div>
          </div>

          <label>Hora disponible</label>
          <div className="availability-line">
            <span>
              {closedSelectedDate
                ? "Cerrado domingo y lunes"
                : slotsLoading
                  ? "Actualizando agenda..."
                  : `${slots.length} espacios disponibles`}
            </span>
            {selectedSlot && <b>{selectedSlot.label} seleccionado</b>}
          </div>
          <div className="slots-grid">
            {slotsLoading && <span className="slot-note">Buscando espacios...</span>}
            {!slotsLoading && closedSelectedDate && (
              <span className="slot-note">La barberia abre de martes a sabado. Elige otro dia.</span>
            )}
            {!slotsLoading && !closedSelectedDate && slots.map((slot) => (
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
            {!slotsLoading && !closedSelectedDate && slots.length === 0 && (
              <span className="slot-note">No hay espacios para esa fecha. Prueba otro dia o servicio.</span>
            )}
          </div>
          {errors.start_min && <small className="field-error">{errors.start_min}</small>}

          <div className="form-grid">
            <div>
              <input
                placeholder="Telefono: 88887777"
                value={form.client_phone}
                inputMode="numeric"
                onChange={(event) => {
                  setErrors({ ...errors, client_phone: "" });
                  setForm({ ...form, client_phone: cleanPhone(event.target.value) });
                }}
                required
              />
              {errors.client_phone && <small className="field-error">{errors.client_phone}</small>}
            </div>
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
        <div className="price-breakdown">
          <span>{selectedService?.name || "Servicio"} <b>{money(selectedService?.price || 0)}</b></span>
          {selectedAddons.map((addon) => (
            <span key={addon.id}>{addon.name} <b>{money(addon.price)}</b></span>
          ))}
          {!selectedAddons.length && <span>Sin extras <b>{money(0)}</b></span>}
        </div>
        <div className="total-line">
          <span>Total</span>
          <strong>{money(total)}</strong>
        </div>
        <small>Si alguien toma una hora, desaparece del calendario para todos.</small>
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
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const filteredRows = rows.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const text = normalizeText(`${item.client_name} ${item.client_phone} ${item.service_name} ${item.barber_name}`);
    return matchesStatus && text.includes(normalizeText(query));
  });
  const dayIncome = rows
    .filter((item) => item.status === "present")
    .reduce((sum, item) => sum + item.total_price, 0);
  const bookedCount = rows.filter((item) => item.status === "booked").length;
  const statusOptions = [
    ["all", "Todos"],
    ["booked", "Reservadas"],
    ["present", "Asistio"],
    ["noshow", "No vino"],
    ["cancelled", "Canceladas"],
    ["blocked", "Bloqueos"],
  ];

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
    try {
      const [appointments, report] = await Promise.all([
        api(`/api/admin/appointments?date=${date}`, { token }),
        api(`/api/admin/stats?year=${now.getFullYear()}&month=${now.getMonth() + 1}`, { token }),
      ]);
      setRows(appointments);
      setStats(report);
      setAdminMsg("");
    } catch (error) {
      setAdminMsg(error.message || "No se pudo cargar el panel.");
    }
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
              <strong>{rows.length}<small>citas del dia</small></strong>
              <strong>{bookedCount}<small>pendientes</small></strong>
              <strong>{money(dayIncome)}<small>generado hoy</small></strong>
              <strong>{money(stats?.income || 0)}<small>ingreso mes</small></strong>
            </div>

            <ReportBoard stats={stats} rows={rows} />

            <div className="admin-toolbar">
              <input
                placeholder="Buscar cliente, telefono o servicio"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="filter-pills">
                {statusOptions.map(([value, label]) => (
                  <button
                    type="button"
                    className={statusFilter === value ? "active" : ""}
                    onClick={() => setStatusFilter(value)}
                    key={value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <form className="block-form" onSubmit={createBlock}>
              <select value={block.start_min} onChange={(event) => setBlock({ ...block, start_min: event.target.value })}>
                {Array.from({ length: 15 }, (_, index) => 480 + index * 45).map((value) => (
                  <option value={value} key={value}>{hourFromMinutes(value)}</option>
                ))}
              </select>
              <select value={block.duration_min} onChange={(event) => setBlock({ ...block, duration_min: event.target.value })}>
                {[45, 60, 90, 120, 180].map((value) => <option value={value} key={value}>{value} min</option>)}
              </select>
              <input placeholder="Nota del bloqueo" value={block.notes} onChange={(event) => setBlock({ ...block, notes: event.target.value })} />
              <button>Bloquear</button>
            </form>

            <div className="appointments">
              {filteredRows.map((item) => (
                <article className={item.status} key={item.id}>
                  <time>{new Date(item.starts_at).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}</time>
                  <div>
                    <b>{item.client_name}</b>
                    <span>{item.service_name} / {money(item.total_price)}</span>
                    <small>
                      {statusLabels[item.status] || item.status}
                      {item.client_phone ? ` / ${item.client_phone}` : ""}
                    </small>
                  </div>
                  {item.status === "blocked" ? (
                    <small className="block-chip">Bloqueo manual</small>
                  ) : (
                    <nav>
                      <button type="button" className="ok-btn" disabled={item.status === "present"} onClick={() => changeStatus(item.id, "present")}>Asistio</button>
                      <button type="button" className="warn-btn" disabled={item.status === "noshow"} onClick={() => changeStatus(item.id, "noshow")}>No vino</button>
                      <button type="button" className="danger-btn" disabled={item.status === "cancelled"} onClick={() => changeStatus(item.id, "cancelled")}>Cancelar</button>
                    </nav>
                  )}
                </article>
              ))}
              {!rows.length && <p className="empty">No hay citas para esta fecha.</p>}
              {!!rows.length && !filteredRows.length && <p className="empty">No hay resultados con ese filtro.</p>}
            </div>
            {adminMsg && <p className="message">{adminMsg}</p>}
          </>
        )}
      </section>
    </div>
  );
}

function ReportBoard({ stats, rows }) {
  const serviceRows = stats?.service_breakdown || [];
  const dailyRows = stats?.daily_income || [];
  const maxDaily = Math.max(...dailyRows.map((item) => item.income), 1);
  const bookedToday = rows.filter((item) => item.status === "booked").length;
  const generatedToday = rows
    .filter((item) => item.status === "present")
    .reduce((sum, item) => sum + item.total_price, 0);

  return (
    <section className="report-board">
      <div className="report-cards">
        <article>
          <TrendingUp size={18} />
          <span>Generado</span>
          <strong>{money(stats?.income || 0)}</strong>
        </article>
        <article>
          <BarChart3 size={18} />
          <span>Proyectado</span>
          <strong>{money(stats?.projected_income || 0)}</strong>
        </article>
        <article>
          <CalendarCheck size={18} />
          <span>Ticket prom.</span>
          <strong>{money(stats?.average_ticket || 0)}</strong>
        </article>
        <article>
          <Flame size={18} />
          <span>Asistencia</span>
          <strong>{stats?.attendance_rate || 0}%</strong>
        </article>
      </div>

      <div className="report-grid">
        <div className="mini-report">
          <h3>Servicios top</h3>
          {serviceRows.slice(0, 5).map((item) => (
            <div className="service-row" key={item.name}>
              <span>{item.name}</span>
              <b>{item.count} / {money(item.income)}</b>
            </div>
          ))}
          {!serviceRows.length && <p className="empty-inline">Sin datos todavia.</p>}
        </div>

        <div className="mini-report">
          <h3>Mes visual</h3>
          <div className="bars">
            {dailyRows.slice(-14).map((item) => (
              <span
                title={`${item.day}: ${money(item.income)}`}
                style={{ height: `${Math.max(10, (item.income / maxDaily) * 100)}%` }}
                key={item.day}
              />
            ))}
            {!dailyRows.length && <p className="empty-inline">Marca asistencias para ver ingresos.</p>}
          </div>
        </div>

        <div className="mini-report day-pulse">
          <h3>Hoy</h3>
          <strong>{bookedToday}</strong>
          <span>pendientes</span>
          <b>{money(generatedToday)} generado</b>
        </div>
      </div>
    </section>
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
