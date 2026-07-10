import { CalendarDays, Home, LogOut, MoveRight, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { diasSemana, dinero, fechaCorta, fechaHumana, hoyISO, minutosAHora, textoEstado, claseEstado } from "../utils/format";

const CALENDAR_EMBED_URL = "https://calendar.google.com/calendar/embed?src=sebasbarberg2021%40gmail.com&ctz=America%2FCosta_Rica";

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
  standalone = false,
}) {
  if (!admin.token) {
    return (
      <section id="admin" className={`seccion bloque ${standalone ? "admin-standalone" : ""}`}>
        {standalone && (
          <a className="btn btn-linea admin-back" href="/">
            <Home size={16} /> Volver a la web
          </a>
        )}
        <div className="admin-login panel reveal">
          <div>
            <span className="eyebrow"><ShieldCheck size={14} />Panel privado</span>
            <h2>Administración de Sebastian</h2>
            <p>Entrá para ver la agenda, cerrar espacios, actualizar servicios y revisar números del negocio.</p>
          </div>
          <form className="formulario" onSubmit={onLogin}>
            <div className="campo">
              <label>Usuario</label>
              <input name="username" defaultValue="sebas" autoComplete="username" required />
            </div>
            <div className="campo">
              <label>Contraseña</label>
              <input name="password" type="password" autoComplete="current-password" required />
            </div>
            <button className="btn btn-principal btn-ancho" type="submit">Entrar</button>
          </form>
          <details className="reset-box">
            <summary>Recuperar contraseña</summary>
            <form className="formulario" onSubmit={onResetPassword}>
              <input name="username" defaultValue="sebas" required />
              <input name="master_code" placeholder="Código maestro" required />
              <input name="new_password" type="password" minLength={8} placeholder="Nueva contraseña" required />
              <button className="btn btn-secundario" type="submit">Cambiar contraseña</button>
            </form>
          </details>
        </div>
      </section>
    );
  }

  const tabs = ["agenda", "servicios", "horarios", "clientes", "reportes"];

  return (
    <section id="admin" className={`seccion bloque admin-shell ${standalone ? "admin-standalone" : ""}`}>
      {standalone && (
        <a className="btn btn-linea admin-back" href="/">
          <Home size={16} /> Volver a la web
        </a>
      )}
      <div className="cabecera-seccion reveal">
        <span className="eyebrow">Panel privado</span>
        <h2>Agenda y control de Sebastian.</h2>
        <p>Una vista tranquila para atender citas, bloquear espacios y revisar el movimiento del mes.</p>
      </div>

      <div className="admin-toolbar panel reveal">
        <div>
          <strong>{admin.perfil?.name || "Sebastian"}</strong>
          <span>{admin.perfil?.role || "Admin"}</span>
        </div>
        <nav className="tabs">
          {tabs.map((tab) => (
            <button className={admin.tab === tab ? "activo" : ""} key={tab} type="button" onClick={() => onTab(tab)}>
              {tab}
            </button>
          ))}
        </nav>
        <button className="btn btn-linea" type="button" onClick={onSalir}><LogOut size={16} />Salir</button>
      </div>

      <Dashboard data={admin.dashboard} />
      {admin.tab === "agenda" && <Agenda admin={admin} onFiltrar={onFiltrar} onEstado={onEstado} onMover={onMover} onBloqueo={onBloqueo} />}
      {admin.tab === "servicios" && <Servicios servicios={admin.servicios} onGuardar={onGuardarServicio} />}
      {admin.tab === "horarios" && <Horarios horarios={admin.horarios} onGuardar={onGuardarHorario} />}
      {admin.tab === "clientes" && <Clientes clientes={admin.clientes} />}
      {admin.tab === "reportes" && <Reportes stats={admin.stats} />}
    </section>
  );
}

function Dashboard({ data }) {
  const safe = data || {};
  const proximas = safe.upcoming || [];
  return (
    <div className="admin-overview reveal">
      <div className="admin-metricas">
        <article><span>Hoy</span><strong>{safe.appointments_today || 0}</strong><small>Citas activas</small></article>
        <article><span>Completadas</span><strong>{safe.completed_today || 0}</strong><small>Asistencias</small></article>
        <article><span>Ingresos hoy</span><strong>{dinero(safe.income_today || 0)}</strong><small>Real generado</small></article>
        <article><span>Proyectado</span><strong>{dinero(safe.projected_today || 0)}</strong><small>Reservas del dia</small></article>
      </div>
      <aside className="panel admin-next">
        <span className="eyebrow"><Sparkles size={14} />Proximas</span>
        <h3>Lo que viene en la silla.</h3>
        <div className="upcoming-list">
          {proximas.slice(0, 4).map((cita) => (
            <article key={cita.id}>
              <strong>{cita.client_name}</strong>
              <span>{fechaHumana(cita.starts_at)}</span>
              <small>{cita.service_name} · {dinero(cita.total_price)}</small>
            </article>
          ))}
          {proximas.length === 0 && <p>No hay citas proximas por ahora.</p>}
        </div>
      </aside>
    </div>
  );
}

function Agenda({ admin, onFiltrar, onEstado, onMover, onBloqueo }) {
  return (
    <>
      <div className="panel reveal">
        <div className="panel-head">
          <div>
            <h3>Agenda</h3>
            <p>Filtrá, confirmá asistencia o mové una cita cuando haga falta.</p>
          </div>
        </div>
        <form className="filtros-admin" onSubmit={onFiltrar}>
          <input name="date" type="date" defaultValue={admin.filtros.date || hoyISO()} />
          <select name="status" defaultValue={admin.filtros.status || ""}>
            <option value="">Todos</option>
            {["booked", "present", "noshow", "cancelled", "blocked"].map((status) => (
              <option value={status} key={status}>{textoEstado(status)}</option>
            ))}
          </select>
          <input name="q" placeholder="Cliente, teléfono o servicio" defaultValue={admin.filtros.q || ""} />
          <button className="btn btn-principal" type="submit">Filtrar</button>
        </form>
        <div className="tabla-citas">
          {admin.citas.length === 0 && <div className="vacio">No hay citas para esos filtros.</div>}
          {admin.citas.map((cita) => (
            <article className="fila-cita" key={cita.id}>
              <div>
                <span className={claseEstado(cita.status)}>{textoEstado(cita.status)}</span>
                <h4>{cita.client_name}</h4>
                <p>{cita.client_phone} · {cita.service_name}</p>
              </div>
              <div>
                <strong>{fechaHumana(cita.starts_at)}</strong>
                <span>{dinero(cita.total_price)}</span>
              </div>
              <div className="acciones-card">
                <button className="btn btn-linea" type="button" onClick={() => onEstado(cita.id, "present")}>Asistió</button>
                <button className="btn btn-linea" type="button" onClick={() => onEstado(cita.id, "noshow")}>No asistió</button>
                <button className="btn btn-linea" type="button" onClick={() => onMover(cita)}><MoveRight size={16} />Mover</button>
                <button className="btn btn-peligro" type="button" onClick={() => onEstado(cita.id, "cancelled")}>Cancelar</button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="agenda-admin-grid reveal">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Bloquear agenda</h3>
              <p>Cerra un dia completo o aparta un rango exacto para descanso, diligencias o citas tomadas fuera de la web.</p>
            </div>
          </div>
          <form className="block-planner" onSubmit={onBloqueo}>
            <div className="campo">
              <label>Fecha</label>
              <input name="date" type="date" min={hoyISO()} defaultValue={hoyISO()} required />
            </div>
            <label className="check-card">
              <input name="all_day" type="checkbox" />
              <span><CalendarDays size={18} /> Cerrar todo el dia</span>
              <small>Ideal para descanso, vacaciones o feriados.</small>
            </label>
            <div className="block-times">
              <div className="campo">
                <label>Desde</label>
                <input name="start_time" type="time" defaultValue="08:00" />
              </div>
              <div className="campo">
                <label>Hasta</label>
                <input name="end_time" type="time" defaultValue="09:00" />
              </div>
            </div>
            <div className="campo">
              <label>Motivo</label>
              <input name="notes" placeholder="Ej: cita manual, descanso, diligencia" />
            </div>
            <button className="btn btn-secundario btn-ancho" type="submit"><Plus size={16} />Guardar bloqueo</button>
          </form>
        </div>

        <div className="panel admin-calendar-panel">
          <div className="panel-head">
            <div>
              <h3>Calendario real</h3>
              <p>Vista rapida del Google Calendar conectado para revisar la semana sin salir del panel.</p>
            </div>
          </div>
          <iframe className="admin-calendar-frame" title="Google Calendar Sebas Barber" src={CALENDAR_EMBED_URL} />
        </div>
      </div>
    </>
  );
}

function Servicios({ servicios, onGuardar }) {
  return (
    <div className="panel reveal">
      <div className="panel-head">
        <div>
          <h3>Servicios</h3>
          <p>Actualizá el menú según lo que se vende en la silla.</p>
        </div>
      </div>
      <form className="form-grid servicio-nuevo" onSubmit={(event) => onGuardar(event)}>
        <input name="name" placeholder="Nuevo servicio" required />
        <input name="duration_min" type="number" min="0" max="360" defaultValue="45" />
        <input name="price" type="number" min="0" defaultValue="6000" />
        <label className="check-line"><input name="is_addon" type="checkbox" /> Extra</label>
        <button className="btn btn-principal" type="submit">Crear</button>
      </form>
      <div className="servicios-admin-grid">
        {servicios.map((servicio) => (
          <form className="servicio-edit" key={servicio.id} onSubmit={(event) => onGuardar(event, servicio.id)}>
            <input name="name" defaultValue={servicio.name} required />
            <input name="duration_min" type="number" min="0" max="360" defaultValue={servicio.duration_min} />
            <input name="price" type="number" min="0" defaultValue={servicio.price} />
            <label className="check-line"><input name="is_addon" type="checkbox" defaultChecked={servicio.is_addon} /> Extra</label>
            <label className="check-line"><input name="is_active" type="checkbox" defaultChecked={servicio.is_active} /> Activo</label>
            <button className="btn btn-secundario" type="submit">Guardar</button>
          </form>
        ))}
      </div>
    </div>
  );
}

function Horarios({ horarios, onGuardar }) {
  return (
    <div className="panel reveal">
      <div className="panel-head">
        <div>
          <h3>Horario semanal</h3>
          <p>Definí cuándo se puede reservar desde la web.</p>
        </div>
      </div>
      <div className="horarios-lista">
        {horarios.map((hora) => (
          <form className="horario-row" key={hora.weekday} onSubmit={(event) => onGuardarHorarioSubmit(event, hora.weekday, onGuardar)}>
            <strong>{diasSemana[hora.weekday]}</strong>
            <label className="check-line"><input name="is_open" type="checkbox" defaultChecked={hora.is_open} /> Abierto</label>
            <input name="open_time" type="time" defaultValue={minutosAHora(hora.open_min)} />
            <input name="close_time" type="time" defaultValue={minutosAHora(hora.close_min)} />
            <button className="btn btn-secundario" type="submit">Guardar</button>
          </form>
        ))}
      </div>
    </div>
  );
}

function onGuardarHorarioSubmit(event, weekday, onGuardar) {
  onGuardar(event, weekday);
}

function Clientes({ clientes }) {
  return (
    <div className="panel reveal">
      <div className="panel-head">
        <div>
          <h3>Clientes</h3>
          <p>Historial rápido para reconocer a quienes vuelven.</p>
        </div>
      </div>
      <div className="clientes-lista">
        {clientes.length === 0 && <div className="vacio">Todavía no hay clientes registrados.</div>}
        {clientes.map((cliente) => (
          <article className="cliente-card" key={cliente.phone}>
            <div>
              <h4>{cliente.name}</h4>
              <p>{cliente.phone}{cliente.email ? ` · ${cliente.email}` : ""}</p>
              <small>Última visita: {cliente.last_visit ? fechaCorta(cliente.last_visit) : "Sin visitas"}</small>
            </div>
            <div><strong>{cliente.appointments}</strong><span>citas</span></div>
            <div><strong>{dinero(cliente.spent)}</strong><span>generado</span></div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Reportes({ stats }) {
  const safe = stats || {};
  const serviceBreakdown = safe.service_breakdown || [];
  const dailyIncome = safe.daily_income || [];
  return (
    <div className="panel reveal">
      <div className="panel-head">
        <div>
          <h3>Reportes del mes</h3>
          <p>Una lectura rápida de lo que está moviendo el negocio.</p>
        </div>
      </div>
      <div className="admin-metricas compactas">
        <article><span>Generado</span><strong>{dinero(safe.income || 0)}</strong><small>Completadas</small></article>
        <article><span>Proyectado</span><strong>{dinero(safe.projected_income || 0)}</strong><small>Mes activo</small></article>
        <article><span>Ticket promedio</span><strong>{dinero(safe.average_ticket || 0)}</strong><small>Por visita</small></article>
        <article><span>Asistencia</span><strong>{safe.attendance_rate || 0}%</strong><small>Control mensual</small></article>
      </div>
      <div className="reportes-grid">
        <div>
          <h4>Servicios más pedidos</h4>
          {serviceBreakdown.map((item) => (
            <p key={item.name}><strong>{item.name}</strong><span>{item.count} · {dinero(item.income)}</span></p>
          ))}
          {serviceBreakdown.length === 0 && <p>Sin datos todavía.</p>}
        </div>
        <div>
          <h4>Movimiento diario</h4>
          {dailyIncome.map((item) => (
            <p key={item.day}><strong>Día {item.day}</strong><span>{item.count} citas · {dinero(item.income)}</span></p>
          ))}
          {dailyIncome.length === 0 && <p>Sin datos todavía.</p>}
        </div>
      </div>
    </div>
  );
}
