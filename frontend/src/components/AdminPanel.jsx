import React from "react";
import {
  BarChart3,
  CalendarCheck,
  CalendarX,
  Clock3,
  Coffee,
  Flame,
  KeyRound,
  Lock,
  ShieldCheck,
  TrendingUp,
  X,
} from "lucide-react";
import { api, money, today } from "../lib/api";
import { blockReasons, blockTimeOptions, hourFromMinutes, normalizeText, statusLabels } from "../utils/business";

export function AdminPanel({ onClose }) {
  const [token, setToken] = React.useState(localStorage.getItem("token") || "");
  const [login, setLogin] = React.useState({ username: "sebas", password: "" });
  const [date, setDate] = React.useState(today());
  const [rows, setRows] = React.useState([]);
  const [stats, setStats] = React.useState(null);
  const [block, setBlock] = React.useState({ mode: "hours", start_min: 480, end_min: 525, notes: "" });
  const [adminMsg, setAdminMsg] = React.useState("");
  const [recoverMode, setRecoverMode] = React.useState(false);
  const [resetForm, setResetForm] = React.useState({ username: "sebas", master_code: "", new_password: "", confirm_password: "" });
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [query, setQuery] = React.useState("");

  const endTimeOptions = blockTimeOptions.filter((value) => value > Number(block.start_min));
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

  async function resetPassword(event) {
    event.preventDefault();
    setAdminMsg("");
    if (resetForm.new_password !== resetForm.confirm_password) {
      setAdminMsg("Las contrasenas no coinciden.");
      return;
    }
    if (resetForm.new_password.length < 8) {
      setAdminMsg("La nueva contrasena debe tener minimo 8 caracteres.");
      return;
    }

    try {
      await api("/api/admin/reset-password", {
        method: "POST",
        body: JSON.stringify({
          username: resetForm.username.trim(),
          master_code: resetForm.master_code.trim(),
          new_password: resetForm.new_password,
        }),
      });
      setRecoverMode(false);
      setLogin({ username: resetForm.username.trim(), password: "" });
      setResetForm({ username: resetForm.username.trim(), master_code: "", new_password: "", confirm_password: "" });
      setAdminMsg("Password actualizado. Ya puedes iniciar sesion.");
    } catch (error) {
      setAdminMsg(error.message || "No se pudo actualizar el password.");
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
    const allDay = block.mode === "day";
    const startMin = Number(block.start_min);
    const endMin = Number(block.end_min);
    if (!allDay && endMin <= startMin) {
      setAdminMsg("La hora final debe ser mayor a la inicial.");
      return;
    }

    await api("/api/admin/blocks", {
      method: "POST",
      token,
      body: JSON.stringify({
        date,
        start_min: allDay ? 480 : startMin,
        end_min: allDay ? 1140 : endMin,
        all_day: allDay,
        notes: block.notes || (allDay ? "Dia bloqueado" : "Bloqueo manual"),
      }),
    });
    setBlock({ mode: "hours", start_min: 480, end_min: 525, notes: "" });
    await load();
    setAdminMsg(allDay ? "Dia bloqueado en agenda." : "Horario bloqueado en agenda.");
  }

  function logout() {
    localStorage.removeItem("token");
    setToken("");
  }

  return (
    <div className="overlay">
      <section className="modal admin-modal">
        <button className="close" onClick={onClose} aria-label="Cerrar"><X /></button>
        {!token ? (
          <div className="login-shell">
            {!recoverMode ? (
              <form className="login-card" onSubmit={submitLogin}>
                <span className="eyebrow">Privado</span>
                <h2>Panel admin</h2>
                <input placeholder="Usuario" value={login.username} onChange={(event) => setLogin({ ...login, username: event.target.value })} />
                <input type="password" placeholder="Password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} />
                <button className="btn btn-primary"><Lock size={17} /> Entrar</button>
                <button type="button" className="btn btn-soft" onClick={() => { setRecoverMode(true); setAdminMsg(""); }}>
                  <KeyRound size={16} /> Recuperar password
                </button>
                {adminMsg && <p className={adminMsg.includes("actualizado") ? "message success" : "message"}>{adminMsg}</p>}
              </form>
            ) : (
              <form className="login-card" onSubmit={resetPassword}>
                <span className="eyebrow">Codigo maestro</span>
                <h2>Recuperar acceso</h2>
                <input placeholder="Usuario: sebas o gabriel" value={resetForm.username} onChange={(event) => setResetForm({ ...resetForm, username: event.target.value })} />
                <input placeholder="Codigo maestro" value={resetForm.master_code} onChange={(event) => setResetForm({ ...resetForm, master_code: event.target.value })} />
                <input type="password" placeholder="Nueva password" value={resetForm.new_password} onChange={(event) => setResetForm({ ...resetForm, new_password: event.target.value })} />
                <input type="password" placeholder="Confirmar password" value={resetForm.confirm_password} onChange={(event) => setResetForm({ ...resetForm, confirm_password: event.target.value })} />
                <button className="btn btn-primary"><ShieldCheck size={17} /> Cambiar password</button>
                <button type="button" className="btn btn-soft" onClick={() => { setRecoverMode(false); setAdminMsg(""); }}>
                  Volver al login
                </button>
                {adminMsg && <p className="message">{adminMsg}</p>}
              </form>
            )}
          </div>
        ) : (
          <>
            <div className="admin-head">
              <div>
                <span className="eyebrow">Control diario</span>
                <h2>Agenda</h2>
              </div>
              <button type="button" className="btn btn-soft" onClick={logout}>Salir</button>
            </div>

            <div className="admin-stats">
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

            <BlockForm
              block={block}
              date={date}
              endTimeOptions={endTimeOptions}
              setBlock={setBlock}
              onSubmit={createBlock}
            />

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
            {adminMsg && <p className={adminMsg.includes("bloqueado") ? "message success" : "message"}>{adminMsg}</p>}
          </>
        )}
      </section>
    </div>
  );
}

function BlockForm({ block, date, endTimeOptions, setBlock, onSubmit }) {
  return (
    <form className="block-form" onSubmit={onSubmit}>
      <div className="block-title">
        <span><CalendarX size={18} /> Bloquear agenda</span>
        <small>{date}</small>
      </div>
      <div className="block-mode">
        <button type="button" className={block.mode === "hours" ? "active" : ""} onClick={() => setBlock({ ...block, mode: "hours" })}>
          <Clock3 size={16} /> Horas
        </button>
        <button type="button" className={block.mode === "day" ? "active" : ""} onClick={() => setBlock({ ...block, mode: "day" })}>
          <Coffee size={16} /> Dia completo
        </button>
      </div>

      {block.mode === "hours" ? (
        <div className="block-grid">
          <label>
            Inicio
            <select value={block.start_min} onChange={(event) => {
              const start = Number(event.target.value);
              const nextEnd = Math.max(Number(block.end_min), start + 15);
              setBlock({ ...block, start_min: start, end_min: nextEnd });
            }}>
              {blockTimeOptions.slice(0, -1).map((value) => (
                <option value={value} key={value}>{hourFromMinutes(value)}</option>
              ))}
            </select>
          </label>
          <label>
            Final
            <select value={block.end_min} onChange={(event) => setBlock({ ...block, end_min: Number(event.target.value) })}>
              {endTimeOptions.map((value) => (
                <option value={value} key={value}>{hourFromMinutes(value)}</option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="day-lock-card">
          <CalendarX size={20} />
          <div>
            <b>Se bloquea todo el horario laboral</b>
            <span>8:00 a 19:00 para descanso, diligencias o cierre especial.</span>
          </div>
        </div>
      )}

      <div className="reason-pills">
        {blockReasons.map((reason) => (
          <button
            type="button"
            className={block.notes === reason ? "active" : ""}
            onClick={() => setBlock({ ...block, notes: reason })}
            key={reason}
          >
            {reason}
          </button>
        ))}
      </div>
      <input placeholder="Nota personalizada opcional" value={block.notes} onChange={(event) => setBlock({ ...block, notes: event.target.value })} />
      <button className="btn btn-primary block-submit">
        <CalendarX size={17} /> {block.mode === "day" ? "Bloquear dia" : "Bloquear horario"}
      </button>
    </form>
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
