import { useState } from "react";
import {
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  CalendarOff,
  CheckCircle2,
  Clock3,
  Home,
  LayoutDashboard,
  LogOut,
  MoveRight,
  Plus,
  Scissors,
  Search,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import {
  claseEstado,
  diasSemana,
  dinero,
  fechaCorta,
  fechaHumana,
  hoyISO,
  minutosAHora,
  textoEstado,
} from "../utils/format";

const CALENDAR_EMBED_URL = "https://calendar.google.com/calendar/embed?src=sebasbarberg2021%40gmail.com&ctz=America%2FCosta_Rica";

const secciones = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "agenda", label: "Agenda", icon: CalendarCheck2 },
  { id: "bloqueos", label: "Bloqueos", icon: CalendarOff },
  { id: "servicios", label: "Servicios", icon: Scissors },
  { id: "horarios", label: "Horarios", icon: Clock3 },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "reportes", label: "Reportes", icon: BarChart3 },
];

export default function AdminPanel({
  admin,
  onLogin,
  onResetPassword,
  onSalir,
  onTab,
  onFiltrar,
  onEstado,
  onMover,
  onBloqueo,
  onGuardarServicio,
  onGuardarHorario,
}) {
  if (!admin.token) {
    return <Login onLogin={onLogin} onResetPassword={onResetPassword} />;
  }

  return (
    <section className="admin-app">
      <header className="admin-topbar">
        <a className="admin-brand" href="/">
          <span><Scissors size={19} /></span>
          <div><strong>Sebas Barber</strong><small>Panel de control</small></div>
        </a>
        <div className="admin-user">
          <div><strong>{admin.perfil?.name || "Sebastian"}</strong><small>{admin.perfil?.role || "Administrador"}</small></div>
          <button className="icon-btn" type="button" onClick={onSalir} aria-label="Cerrar sesion" title="Cerrar sesion">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <nav aria-label="Secciones del panel">
            {secciones.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className={admin.tab === item.id ? "activo" : ""}
                  key={item.id}
                  type="button"
                  onClick={() => onTab(item.id)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          <a href="/"><Home size={18} /><span>Volver a la web</span></a>
        </aside>

        <main className="admin-content">
          {admin.tab === "resumen" && <Dashboard data={admin.dashboard} stats={admin.stats} onTab={onTab} />}
          {admin.tab === "agenda" && (
            <Agenda admin={admin} onFiltrar={onFiltrar} onEstado={onEstado} onMover={onMover} />
          )}
          {admin.tab === "bloqueos" && <Bloqueos onBloqueo={onBloqueo} />}
          {admin.tab === "servicios" && <Servicios servicios={admin.servicios} onGuardar={onGuardarServicio} />}
          {admin.tab === "horarios" && <Horarios horarios={admin.horarios} onGuardar={onGuardarHorario} />}
          {admin.tab === "clientes" && <Clientes clientes={admin.clientes} />}
          {admin.tab === "reportes" && <Reportes stats={admin.stats} />}
        </main>
      </div>
    </section>
  );
}

function Login({ onLogin, onResetPassword }) {
  return (
    <section className="admin-login-page">
      <a className="btn btn-linea admin-back" href="/"><Home size={16} />Volver a la web</a>
      <div className="admin-login-shell">
        <div className="admin-login-copy">
          <span className="admin-login-mark"><Scissors size={26} /></span>
          <span className="eyebrow"><ShieldCheck size={14} />Acceso privado</span>
          <h1>Controla la agenda sin enredos.</h1>
          <p>Citas, bloqueos, horarios, servicios y numeros del negocio en un solo lugar.</p>
        </div>
        <div className="admin-login-form">
          <div>
            <h2>Iniciar sesion</h2>
            <p>Ingresa con la cuenta de Sebastian.</p>
          </div>
          <form className="formulario" onSubmit={onLogin}>
            <div className="campo">
              <label htmlFor="admin-user">Usuario</label>
              <input id="admin-user" name="username" defaultValue="sebas" autoComplete="username" required />
            </div>
            <div className="campo">
              <label htmlFor="admin-password">Contrasena</label>
              <input id="admin-password" name="password" type="password" minLength={8} autoComplete="current-password" required />
            </div>
            <button className="btn btn-principal btn-ancho" type="submit">Entrar al panel</button>
          </form>
          <details className="reset-box">
            <summary>Olvide mi contrasena</summary>
            <form className="formulario" onSubmit={onResetPassword}>
              <input name="username" defaultValue="sebas" aria-label="Usuario" required />
              <input name="master_code" minLength={32} placeholder="Codigo maestro" aria-label="Codigo maestro" required />
              <input name="new_password" type="password" minLength={8} placeholder="Nueva contrasena" aria-label="Nueva contrasena" required />
              <button className="btn btn-secundario" type="submit">Cambiar contrasena</button>
            </form>
          </details>
        </div>
      </div>
    </section>
  );
}

function PageHead({ eyebrow, title, text, action }) {
  return (
    <div className="admin-page-head">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}

function Dashboard({ data, stats, onTab }) {
  const safe = data || {};
  const monthly = stats || {};
  const proximas = safe.upcoming || [];

  return (
    <>
      <PageHead
        eyebrow="Resumen"
        title="Buen dia, Sebastian."
        text="Esto es lo importante de hoy y del mes actual."
        action={<button className="btn btn-principal" type="button" onClick={() => onTab("bloqueos")}><CalendarOff size={17} />Bloquear agenda</button>}
      />
      <div className="admin-metrics">
        <article><span>Citas hoy</span><strong>{safe.appointments_today || 0}</strong><small>{safe.pending_today || 0} pendientes</small></article>
        <article><span>Generado hoy</span><strong>{dinero(safe.income_today || 0)}</strong><small>{dinero(safe.projected_today || 0)} proyectado</small></article>
        <article><span>Generado este mes</span><strong>{dinero(monthly.income || 0)}</strong><small>{monthly.attended || 0} citas completadas</small></article>
        <article><span>Ticket promedio</span><strong>{dinero(monthly.average_ticket || 0)}</strong><small>{monthly.attendance_rate || 0}% asistencia</small></article>
      </div>
      <div className="dashboard-grid">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div><span>Agenda</span><h2>Proximas citas</h2></div>
            <button className="btn btn-linea" type="button" onClick={() => onTab("agenda")}>Ver agenda</button>
          </div>
          <div className="upcoming-list">
            {proximas.slice(0, 6).map((cita) => (
              <article key={cita.id}>
                <div className="time-badge"><Clock3 size={16} /></div>
                <div><strong>{cita.client_name}</strong><span>{cita.service_name}</span></div>
                <div><strong>{fechaHumana(cita.starts_at)}</strong><small>{dinero(cita.total_price)}</small></div>
              </article>
            ))}
            {proximas.length === 0 && <EmptyState text="No hay citas proximas." />}
          </div>
        </section>
        <aside className="admin-panel month-snapshot">
          <div className="admin-panel-head"><div><span>Mes actual</span><h2>Rendimiento</h2></div></div>
          <div className="snapshot-row"><span>Servicio mas pedido</span><strong>{monthly.top_service || "Sin datos"}</strong></div>
          <div className="snapshot-row"><span>Ingresos proyectados</span><strong>{dinero(monthly.projected_income || 0)}</strong></div>
          <div className="snapshot-row"><span>Cancelaciones</span><strong>{monthly.cancellation_rate || 0}%</strong></div>
          <button className="btn btn-secundario btn-ancho" type="button" onClick={() => onTab("reportes")}>Abrir reportes</button>
        </aside>
      </div>
    </>
  );
}

function Agenda({ admin, onFiltrar, onEstado, onMover }) {
  return (
    <>
      <PageHead eyebrow="Agenda" title="Citas y asistencia" text="Busca una reserva, confirma la visita o cambia la hora." />
      <section className="admin-panel">
        <form className="admin-filters" onSubmit={onFiltrar}>
          <div className="filter-search"><Search size={17} /><input name="q" placeholder="Cliente, telefono o servicio" defaultValue={admin.filtros.q || ""} /></div>
          <input name="date" type="date" defaultValue={admin.filtros.date || hoyISO()} aria-label="Fecha" />
          <select name="status" defaultValue={admin.filtros.status || ""} aria-label="Estado">
            <option value="">Todos los estados</option>
            {["booked", "present", "noshow", "cancelled", "blocked"].map((status) => (
              <option value={status} key={status}>{textoEstado(status)}</option>
            ))}
          </select>
          <button className="btn btn-principal" type="submit">Aplicar filtros</button>
        </form>
        <div className="appointments-table">
          {admin.citas.length === 0 && <EmptyState text="No hay citas para esos filtros." />}
          {admin.citas.map((cita) => (
            <article className="appointment-row" key={cita.id}>
              <div className="appointment-main">
                <span className={claseEstado(cita.status)}>{textoEstado(cita.status)}</span>
                <h3>{cita.client_name}</h3>
                <p>{cita.client_phone} | {cita.service_name}</p>
              </div>
              <div className="appointment-time">
                <strong>{fechaHumana(cita.starts_at)}</strong>
                <span>{dinero(cita.total_price)}</span>
              </div>
              <div className="appointment-actions">
                {cita.status === "booked" && (
                  <>
                    <button className="btn btn-success" type="button" onClick={() => onEstado(cita.id, "present")}><CheckCircle2 size={16} />Asistio</button>
                    <button className="btn btn-linea" type="button" onClick={() => onEstado(cita.id, "noshow")}><XCircle size={16} />No asistio</button>
                  </>
                )}
                {["booked", "blocked"].includes(cita.status) && (
                  <>
                    <button className="icon-btn" type="button" onClick={() => onMover(cita)} title="Mover cita" aria-label="Mover cita"><MoveRight size={17} /></button>
                    <button className="icon-btn danger" type="button" onClick={() => onEstado(cita.id, "cancelled")} title="Cancelar o liberar" aria-label="Cancelar o liberar"><XCircle size={17} /></button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function Bloqueos({ onBloqueo }) {
  const [modo, setModo] = useState("horas");
  const [inicio, setInicio] = useState("08:00");
  const [fin, setFin] = useState("09:00");

  const usarRango = (desde, hasta) => {
    setModo("horas");
    setInicio(desde);
    setFin(hasta);
  };

  return (
    <>
      <PageHead eyebrow="Disponibilidad" title="Bloquea un dia o unas horas" text="Usa un cierre completo para descanso y un rango para diligencias o citas tomadas por fuera." />
      <div className="block-admin-grid">
        <section className="admin-panel">
          <div className="segmented-control" aria-label="Tipo de bloqueo">
            <button className={modo === "horas" ? "activo" : ""} type="button" onClick={() => setModo("horas")}><Clock3 size={17} />Unas horas</button>
            <button className={modo === "dia" ? "activo" : ""} type="button" onClick={() => setModo("dia")}><CalendarDays size={17} />Dia completo</button>
          </div>
          <form className="block-form" onSubmit={onBloqueo}>
            <input type="hidden" name="all_day" value={modo === "dia" ? "on" : ""} />
            <div className="campo">
              <label htmlFor="block-date">Fecha</label>
              <input id="block-date" name="date" type="date" min={hoyISO()} defaultValue={hoyISO()} required />
            </div>
            {modo === "horas" && (
              <>
                <div className="quick-ranges">
                  <button type="button" onClick={() => usarRango("08:00", "12:00")}>Manana</button>
                  <button type="button" onClick={() => usarRango("12:00", "13:00")}>Almuerzo</button>
                  <button type="button" onClick={() => usarRango("13:00", "17:00")}>Tarde</button>
                  <button type="button" onClick={() => usarRango("17:00", "19:00")}>Cierre</button>
                </div>
                <div className="block-times">
                  <div className="campo"><label htmlFor="block-start">Desde</label><input id="block-start" name="start_time" type="time" value={inicio} onChange={(event) => setInicio(event.target.value)} required /></div>
                  <div className="campo"><label htmlFor="block-end">Hasta</label><input id="block-end" name="end_time" type="time" value={fin} onChange={(event) => setFin(event.target.value)} required /></div>
                </div>
              </>
            )}
            <div className="campo">
              <label htmlFor="block-reason">Motivo</label>
              <input id="block-reason" name="notes" maxLength={240} placeholder={modo === "dia" ? "Ej: descanso o vacaciones" : "Ej: cita manual o diligencia"} />
            </div>
            <button className="btn btn-principal btn-ancho" type="submit"><Plus size={17} />Guardar bloqueo</button>
          </form>
        </section>
        <section className="admin-panel calendar-panel">
          <div className="admin-panel-head"><div><span>Google Calendar</span><h2>Semana visible</h2></div></div>
          <iframe className="admin-calendar-frame" title="Google Calendar Sebas Barber" src={CALENDAR_EMBED_URL} />
        </section>
      </div>
    </>
  );
}

function Servicios({ servicios, onGuardar }) {
  return (
    <>
      <PageHead eyebrow="Menu" title="Servicios y precios" text="Edita lo que aparece en la reserva. Los extras suman precio, no tiempo." />
      <section className="admin-panel">
        <form className="service-create" onSubmit={(event) => onGuardar(event)}>
          <input name="name" placeholder="Nombre del servicio" required />
          <label><span>Duracion</span><input name="duration_min" type="number" min="0" max="360" defaultValue="45" /></label>
          <label><span>Precio</span><input name="price" type="number" min="0" defaultValue="6000" /></label>
          <label className="toggle-line"><input name="is_addon" type="checkbox" /><span>Es un extra</span></label>
          <button className="btn btn-principal" type="submit"><Plus size={17} />Crear</button>
        </form>
        <div className="service-admin-list">
          {servicios.map((servicio) => (
            <form className="service-admin-row" key={servicio.id} onSubmit={(event) => onGuardar(event, servicio.id)}>
              <input name="name" defaultValue={servicio.name} aria-label="Nombre" required />
              <label><span>Minutos</span><input name="duration_min" type="number" min="0" max="360" defaultValue={servicio.duration_min} /></label>
              <label><span>Precio</span><input name="price" type="number" min="0" defaultValue={servicio.price} /></label>
              <label className="toggle-line"><input name="is_addon" type="checkbox" defaultChecked={servicio.is_addon} /><span>Extra</span></label>
              <label className="toggle-line"><input name="is_active" type="checkbox" defaultChecked={servicio.is_active} /><span>Visible</span></label>
              <button className="btn btn-secundario" type="submit">Guardar</button>
            </form>
          ))}
        </div>
      </section>
    </>
  );
}

function Horarios({ horarios, onGuardar }) {
  return (
    <>
      <PageHead eyebrow="Semana" title="Horario de reservas" text="Los clientes solo veran horas dentro de estos rangos." />
      <section className="admin-panel">
        <div className="business-hours-list">
          {horarios.map((hora) => (
            <form className="business-hour-row" key={hora.weekday} onSubmit={(event) => onGuardar(event, hora.weekday)}>
              <strong>{diasSemana[hora.weekday]}</strong>
              <label className="toggle-line"><input name="is_open" type="checkbox" defaultChecked={hora.is_open} /><span>Abierto</span></label>
              <label><span>Abre</span><input name="open_time" type="time" defaultValue={minutosAHora(hora.open_min)} /></label>
              <label><span>Cierra</span><input name="close_time" type="time" defaultValue={minutosAHora(hora.close_min)} /></label>
              <button className="btn btn-secundario" type="submit">Guardar</button>
            </form>
          ))}
        </div>
      </section>
    </>
  );
}

function Clientes({ clientes }) {
  return (
    <>
      <PageHead eyebrow="Clientes" title="Historial de visitas" text="Identifica clientes frecuentes y revisa cuanto han generado." />
      <section className="admin-panel">
        <div className="clients-list">
          {clientes.length === 0 && <EmptyState text="Todavia no hay clientes registrados." />}
          {clientes.map((cliente) => (
            <article className="client-row" key={cliente.phone}>
              <span className="client-avatar">{cliente.name?.slice(0, 1).toUpperCase()}</span>
              <div><h3>{cliente.name}</h3><p>{cliente.phone}{cliente.email ? ` | ${cliente.email}` : ""}</p><small>Ultima visita: {cliente.last_visit ? fechaCorta(cliente.last_visit) : "Sin visitas"}</small></div>
              <div><strong>{cliente.appointments}</strong><span>citas</span></div>
              <div><strong>{dinero(cliente.spent)}</strong><span>generado</span></div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function Reportes({ stats }) {
  const safe = stats || {};
  const serviceBreakdown = safe.service_breakdown || [];
  const dailyIncome = safe.daily_income || [];
  const maxServicio = Math.max(...serviceBreakdown.map((item) => item.count), 1);
  const maxDia = Math.max(...dailyIncome.map((item) => item.income), 1);

  return (
    <>
      <PageHead eyebrow="Reportes" title="Numeros del mes" text="Ingresos, asistencia y servicios con mayor movimiento." />
      <div className="admin-metrics report-metrics">
        <article><span>Generado</span><strong>{dinero(safe.income || 0)}</strong><small>{safe.attended || 0} completadas</small></article>
        <article><span>Proyectado</span><strong>{dinero(safe.projected_income || 0)}</strong><small>{safe.booked || 0} reservadas</small></article>
        <article><span>Ticket promedio</span><strong>{dinero(safe.average_ticket || 0)}</strong><small>Por visita</small></article>
        <article><span>Asistencia</span><strong>{safe.attendance_rate || 0}%</strong><small>{safe.noshow || 0} ausencias</small></article>
      </div>
      <div className="reports-grid">
        <section className="admin-panel">
          <div className="admin-panel-head"><div><span>Demanda</span><h2>Servicios mas pedidos</h2></div></div>
          <div className="chart-list">
            {serviceBreakdown.map((item) => (
              <article key={item.name}>
                <div><strong>{item.name}</strong><span>{item.count} citas | {dinero(item.income)}</span></div>
                <div className="chart-track"><i style={{ width: `${Math.max((item.count / maxServicio) * 100, 6)}%` }} /></div>
              </article>
            ))}
            {serviceBreakdown.length === 0 && <EmptyState text="Aun no hay datos para este mes." />}
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-head"><div><span>Ingresos</span><h2>Movimiento diario</h2></div></div>
          <div className="chart-list">
            {dailyIncome.map((item) => (
              <article key={item.day}>
                <div><strong>Dia {item.day}</strong><span>{item.count} citas | {dinero(item.income)}</span></div>
                <div className="chart-track"><i style={{ width: `${Math.max((item.income / maxDia) * 100, 6)}%` }} /></div>
              </article>
            ))}
            {dailyIncome.length === 0 && <EmptyState text="Aun no hay ingresos completados." />}
          </div>
        </section>
      </div>
    </>
  );
}

function EmptyState({ text }) {
  return <div className="admin-empty"><CalendarDays size={24} /><span>{text}</span></div>;
}
