import { useState } from "react";
import {
  BarChart3,
  BellRing,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarDays,
  CalendarOff,
  Clock3,
  Database,
  Home,
  History,
  Images,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Plus,
  MessageSquareQuote,
  Scissors,
  ShieldCheck,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import {
  diasSemana,
  dinero,
  fechaHumana,
  fechaCorta,
  horaAMinutos,
  hoyISO,
  minutosAHora,
} from "../utils/format";
import AdminAgenda from "./admin/AdminAgenda";
import AdminClients from "./admin/AdminClients";
import AdminDashboard from "./admin/AdminDashboard";
import AdminGallery from "./admin/AdminGallery";
import AdminReviews from "./admin/AdminReviews";
import AdminWaitlist from "./admin/AdminWaitlist";
import AdminOperations from "./admin/AdminOperations";
import PageHead from "./admin/AdminPageHead";

const secciones = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "agenda", label: "Agenda", icon: CalendarCheck2 },
  { id: "espera", label: "Lista de espera", icon: BellRing },
  { id: "bloqueos", label: "Bloqueos", icon: CalendarOff },
  { id: "servicios", label: "Servicios", icon: Scissors },
  { id: "horarios", label: "Horarios", icon: Clock3 },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "resenas", label: "Reseñas", icon: MessageSquareQuote },
  { id: "galeria", label: "Galería", icon: Images },
  { id: "reportes", label: "Reportes", icon: BarChart3 },
  { id: "operacion", label: "Negocio", icon: BriefcaseBusiness },
  { id: "actividad", label: "Actividad", icon: History },
  { id: "seguridad", label: "Seguridad", icon: LockKeyhole },
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
  onAusencia,
  onEliminarAusencia,
  onGuardarServicio,
  onGuardarHorario,
  onChangePassword,
  onBloqueoRapido,
  onEstadoListaEspera,
  onModerarReseña,
  onCrearImagen,
  onSubirImagen,
  onEditarImagen,
  onEliminarImagen,
  onGuardarConfiguracion,
  onCrearPausa,
  onEliminarPausa,
  onCrearPromocion,
  onAlternarPromocion,
  onEliminarPromocion,
  onCrearGasto,
  onEliminarGasto,
  onCrearCierre,
  onDescargarRespaldo,
  onActualizarCliente,
  onAnonimizarCliente,
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
          <div><strong>{admin.perfil?.name || "Sebastián"}</strong><small>{admin.perfil?.role || "Administrador"}</small></div>
          <button className="icon-btn" type="button" onClick={onSalir} aria-label="Cerrar sesión" title="Cerrar sesión">
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
                  onClick={(event) => {
                    onTab(item.id);
                    event.currentTarget.scrollIntoView({
                      behavior: "smooth",
                      block: "nearest",
                      inline: "center",
                    });
                  }}
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
          {admin.tab === "resumen" && (
            <AdminDashboard
              data={admin.dashboard}
              stats={admin.stats}
              operations={admin.operaciones?.metrics}
              perfil={admin.perfil}
              onTab={onTab}
              onBloqueoRapido={onBloqueoRapido}
            />
          )}
          {admin.tab === "agenda" && (
            <AdminAgenda admin={admin} onFiltrar={onFiltrar} onEstado={onEstado} onMover={onMover} />
          )}
          {admin.tab === "espera" && (
            <AdminWaitlist
              items={admin.listaEspera}
              onStatus={onEstadoListaEspera}
            />
          )}
          {admin.tab === "bloqueos" && (
            <Bloqueos
              perfil={admin.perfil}
              bloqueos={admin.bloqueos}
              ausencias={admin.ausencias}
              onBloqueo={onBloqueo}
              onAusencia={onAusencia}
              onEliminarAusencia={onEliminarAusencia}
              onLiberar={(id) => onEstado(id, "cancelled")}
            />
          )}
          {admin.tab === "servicios" && <Servicios servicios={admin.servicios} onGuardar={onGuardarServicio} />}
          {admin.tab === "horarios" && <Horarios horarios={admin.horarios} onGuardar={onGuardarHorario} />}
          {admin.tab === "clientes" && (
            <AdminClients
              clientes={admin.clientes}
              onUpdate={onActualizarCliente}
              onAnonymize={onAnonimizarCliente}
            />
          )}
          {admin.tab === "resenas" && (
            <AdminReviews items={admin.reseñas} onStatus={onModerarReseña} />
          )}
          {admin.tab === "galeria" && (
            <AdminGallery
              items={admin.galeria}
              onCreate={onCrearImagen}
              onUpload={onSubirImagen}
              onEdit={onEditarImagen}
              onDelete={onEliminarImagen}
            />
          )}
          {admin.tab === "reportes" && <Reportes stats={admin.stats} />}
          {admin.tab === "operacion" && (
            <AdminOperations
              data={admin.operaciones}
              services={admin.servicios}
              onSaveSettings={onGuardarConfiguracion}
              onCreateBreak={onCrearPausa}
              onDeleteBreak={onEliminarPausa}
              onCreatePromotion={onCrearPromocion}
              onTogglePromotion={onAlternarPromocion}
              onDeletePromotion={onEliminarPromocion}
              onCreateExpense={onCrearGasto}
              onDeleteExpense={onEliminarGasto}
              onCreateCashClose={onCrearCierre}
              onDownloadBackup={onDescargarRespaldo}
            />
          )}
          {admin.tab === "actividad" && <Actividad items={admin.actividad} />}
          {admin.tab === "seguridad" && <Seguridad onChangePassword={onChangePassword} />}
        </main>
      </div>
    </section>
  );
}

function Login({ onLogin, onResetPassword }) {
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [resetForm, setResetForm] = useState({
    username: "",
    master_code: "",
    new_password: "",
  });

  const enviarLogin = async (event) => {
    event.preventDefault();
    await onLogin(loginForm);
  };

  const enviarRecuperacion = async (event) => {
    event.preventDefault();
    const actualizado = await onResetPassword(resetForm);
    if (actualizado) {
      setResetForm({ username: "", master_code: "", new_password: "" });
    }
  };

  return (
    <section className="admin-login-page">
      <a className="btn btn-linea admin-back" href="/"><Home size={16} />Volver a la web</a>
      <div className="admin-login-shell">
        <div className="admin-login-copy">
          <span className="admin-login-mark"><Scissors size={26} /></span>
          <span className="eyebrow"><ShieldCheck size={14} />Acceso privado</span>
          <h1>Controla la agenda sin enredos.</h1>
          <p>Citas, bloqueos, horarios, servicios y números del negocio en un solo lugar.</p>
        </div>
        <div className="admin-login-form">
          <div>
            <h2>Iniciar sesión</h2>
            <p>Usa tu cuenta personal para abrir solamente tu agenda.</p>
          </div>
          <form className="formulario grid gap-4" onSubmit={enviarLogin}>
            <div className="campo">
              <label htmlFor="admin-user">Usuario</label>
              <input
                id="admin-user"
                name="username"
                value={loginForm.username}
                placeholder="sebas o gabriel"
                autoComplete="username"
                required
                onChange={(event) => setLoginForm((actual) => ({ ...actual, username: event.target.value }))}
              />
            </div>
            <div className="campo">
              <label htmlFor="admin-password">Contraseña</label>
              <input
                id="admin-password"
                name="password"
                type="password"
                minLength={8}
                value={loginForm.password}
                autoComplete="current-password"
                required
                onChange={(event) => setLoginForm((actual) => ({ ...actual, password: event.target.value }))}
              />
            </div>
            <button className="btn btn-principal btn-ancho" type="submit">Entrar al panel</button>
          </form>
          <details className="reset-box">
            <summary>Olvidé mi contraseña</summary>
            <form className="formulario grid gap-3" onSubmit={enviarRecuperacion}>
              <input
                name="username"
                value={resetForm.username}
                placeholder="Usuario"
                aria-label="Usuario"
                required
                onChange={(event) => setResetForm((actual) => ({ ...actual, username: event.target.value }))}
              />
              <input
                name="master_code"
                minLength={32}
                value={resetForm.master_code}
                placeholder="Código maestro"
                aria-label="Código maestro"
                required
                onChange={(event) => setResetForm((actual) => ({ ...actual, master_code: event.target.value }))}
              />
              <input
                name="new_password"
                type="password"
                minLength={8}
                value={resetForm.new_password}
                placeholder="Nueva contraseña"
                aria-label="Nueva contraseña"
                required
                onChange={(event) => setResetForm((actual) => ({ ...actual, new_password: event.target.value }))}
              />
              <button className="btn btn-secundario" type="submit">Cambiar contraseña</button>
            </form>
          </details>
        </div>
      </div>
    </section>
  );
}

function Bloqueos({
  perfil,
  bloqueos = [],
  ausencias = [],
  onBloqueo,
  onAusencia,
  onEliminarAusencia,
  onLiberar,
}) {
  const [modo, setModo] = useState("horas");
  const [fecha, setFecha] = useState(hoyISO());
  const [inicio, setInicio] = useState("08:00");
  const [fin, setFin] = useState("09:00");
  const [motivo, setMotivo] = useState("");
  const [blockError, setBlockError] = useState("");
  const [absenceError, setAbsenceError] = useState("");
  const [ausencia, setAusencia] = useState({
    start_date: hoyISO(),
    end_date: hoyISO(),
    kind: "vacation",
    title: "",
    notes: "",
  });

  const usarRango = (desde, hasta) => {
    setModo("horas");
    setInicio(desde);
    setFin(hasta);
    setBlockError("");
  };

  const guardarBloqueo = async (event) => {
    event.preventDefault();
    const startMin = horaAMinutos(inicio);
    const endMin = horaAMinutos(fin);

    if (modo === "horas" && endMin <= startMin) {
      setBlockError("La hora final debe ser posterior a la hora inicial.");
      return;
    }

    setBlockError("");
    const guardado = await onBloqueo({
      date: fecha,
      all_day: modo === "dia",
      start_min: modo === "dia" ? 480 : startMin,
      end_min: modo === "dia" ? null : endMin,
      notes: motivo.trim() || null,
    });
    if (guardado) setMotivo("");
  };

  const guardarAusencia = async (event) => {
    event.preventDefault();
    if (ausencia.end_date < ausencia.start_date) {
      setAbsenceError("La fecha final debe ser igual o posterior a la inicial.");
      return;
    }
    const guardado = await onAusencia({
      ...ausencia,
      all_day: true,
      start_min: null,
      end_min: null,
      notes: ausencia.notes.trim() || null,
    });
    if (guardado) {
      setAusencia((actual) => ({ ...actual, title: "", notes: "" }));
      setAbsenceError("");
    }
  };

  return (
    <>
      <PageHead eyebrow="Disponibilidad" title="Bloquea un día o unas horas" text="Usa un cierre completo para descanso y un rango para diligencias o citas tomadas por fuera." />
      <div className="block-admin-grid">
        <section className="admin-panel">
          <div className="segmented-control" aria-label="Tipo de bloqueo">
            <button className={modo === "horas" ? "activo" : ""} type="button" onClick={() => setModo("horas")}><Clock3 size={17} />Unas horas</button>
            <button className={modo === "dia" ? "activo" : ""} type="button" onClick={() => setModo("dia")}><CalendarDays size={17} />Día completo</button>
          </div>
          <form className="block-form" onSubmit={guardarBloqueo}>
            <div className="campo">
              <label htmlFor="block-date">Fecha</label>
              <input
                id="block-date"
                name="date"
                type="date"
                min={hoyISO()}
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
                required
              />
            </div>
            {modo === "horas" && (
              <>
                <div className="quick-ranges">
                  <button type="button" onClick={() => usarRango("08:00", "12:00")}>Mañana</button>
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
              <input
                id="block-reason"
                name="notes"
                maxLength={240}
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder={modo === "dia" ? "Ej.: descanso o vacaciones" : "Ej.: cita manual o diligencia"}
              />
            </div>
            {blockError && <p className="form-error" role="alert">{blockError}</p>}
            <button className="btn btn-principal btn-ancho" type="submit"><Plus size={17} />Guardar bloqueo</button>
          </form>
        </section>
        <section className="admin-panel calendar-panel">
          {perfil?.calendar_connected && perfil?.calendar_embed_url ? (
            <>
              <div className="admin-panel-head"><div><span>Agenda conectada</span><h2>Semana visible</h2></div></div>
              <iframe
                className="admin-calendar-frame"
                title={`Calendario de ${perfil?.name || "barbero"}`}
                src={perfil.calendar_embed_url}
              />
            </>
          ) : (
            <div className="local-agenda-state">
              <span><Database size={24} /></span>
              <div>
                <small>Agenda no conectada</small>
                <h2>Revisa la configuración de Calendar.</h2>
                <p>Las citas siguen protegidas en el sistema, pero falta conectar el calendario de {perfil?.name || "este barbero"}.</p>
              </div>
            </div>
          )}
          <div className="block-overview">
            <div className="admin-panel-head">
              <div><span>Próximos</span><h2>Bloqueos activos</h2></div>
              <strong>{bloqueos.length}</strong>
            </div>
            <div className="block-list">
              {bloqueos.map((bloqueo) => (
                <article key={bloqueo.id}>
                  <div>
                    <strong>{fechaHumana(bloqueo.starts_at)}</strong>
                    <span>{bloqueo.notes || bloqueo.service_name}</span>
                  </div>
                  <button
                    className="icon-btn danger"
                    type="button"
                    onClick={() => onLiberar(bloqueo.id)}
                    aria-label="Liberar horario"
                    title="Liberar horario"
                  >
                    <XCircle size={17} />
                  </button>
                </article>
              ))}
              {bloqueos.length === 0 && <EmptyState text="No hay bloqueos pendientes." />}
            </div>
          </div>
        </section>
      </div>
      <section className="admin-panel planned-availability">
        <div className="admin-panel-head">
          <div>
            <span>Ausencias planificadas</span>
            <h2>Feriados y vacaciones</h2>
          </div>
          <strong>{ausencias.length}</strong>
        </div>
        <div className="planned-availability-grid">
          <form className="availability-form" onSubmit={guardarAusencia}>
            <div className="form-doble">
              <div className="campo">
                <label htmlFor="absence-start">Desde</label>
                <input
                  id="absence-start"
                  type="date"
                  min={hoyISO()}
                  value={ausencia.start_date}
                  onChange={(event) => setAusencia((actual) => ({
                    ...actual,
                    start_date: event.target.value,
                    end_date: event.target.value > actual.end_date
                      ? event.target.value
                      : actual.end_date,
                  }))}
                  required
                />
              </div>
              <div className="campo">
                <label htmlFor="absence-end">Hasta</label>
                <input
                  id="absence-end"
                  type="date"
                  min={ausencia.start_date}
                  value={ausencia.end_date}
                  onChange={(event) => setAusencia((actual) => ({
                    ...actual,
                    end_date: event.target.value,
                  }))}
                  required
                />
              </div>
            </div>
            <div className="campo">
              <label htmlFor="absence-kind">Tipo</label>
              <select
                id="absence-kind"
                value={ausencia.kind}
                onChange={(event) => setAusencia((actual) => ({
                  ...actual,
                  kind: event.target.value,
                }))}
              >
                <option value="vacation">Vacaciones</option>
                <option value="holiday">Feriado</option>
                <option value="personal">Asunto personal</option>
                <option value="custom">Otro cierre</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="absence-title">Nombre</label>
              <input
                id="absence-title"
                value={ausencia.title}
                maxLength={120}
                placeholder="Ej.: vacaciones de agosto"
                onChange={(event) => setAusencia((actual) => ({
                  ...actual,
                  title: event.target.value,
                }))}
                required
              />
            </div>
            <div className="campo">
              <label htmlFor="absence-notes">Nota opcional</label>
              <input
                id="absence-notes"
                value={ausencia.notes}
                maxLength={240}
                placeholder="Detalle interno"
                onChange={(event) => setAusencia((actual) => ({
                  ...actual,
                  notes: event.target.value,
                }))}
              />
            </div>
            {absenceError && <p className="form-error" role="alert">{absenceError}</p>}
            <button className="btn btn-principal" type="submit">
              <CalendarOff size={17} />
              Guardar ausencia
            </button>
          </form>
          <div className="availability-list">
            {ausencias.map((item) => (
              <article key={item.id}>
                <span className="history-icon"><CalendarOff size={17} /></span>
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    {fechaCorta(`${item.start_date}T12:00:00`)}
                    {item.end_date !== item.start_date
                      ? ` al ${fechaCorta(`${item.end_date}T12:00:00`)}`
                      : ""}
                  </span>
                  {item.notes && <small>{item.notes}</small>}
                </div>
                <button
                  className="icon-btn danger"
                  type="button"
                  onClick={() => onEliminarAusencia(item.id)}
                  title="Eliminar ausencia"
                  aria-label={`Eliminar ${item.title}`}
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
            {ausencias.length === 0 && (
              <EmptyState text="No hay feriados o vacaciones programados." />
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function Servicios({ servicios, onGuardar }) {
  return (
    <>
      <PageHead eyebrow="Menú" title="Servicios y precios" text="Edita lo que aparece en la reserva. Los extras suman precio, no tiempo." />
      <section className="admin-panel">
        <form className="service-create" onSubmit={(event) => onGuardar(event)}>
          <input name="name" placeholder="Nombre del servicio" required />
          <label><span>Duración</span><input name="duration_min" type="number" min="0" max="360" defaultValue="45" /></label>
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
      <PageHead eyebrow="Semana" title="Horario de reservas" text="Los clientes solo verán horas dentro de estos rangos." />
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

function Seguridad({ onChangePassword }) {
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirmation: "",
  });
  const [error, setError] = useState("");

  const actualizarCampo = (campo, valor) => {
    setForm((actual) => ({ ...actual, [campo]: valor }));
    setError("");
  };

  const guardar = async (event) => {
    event.preventDefault();
    if (form.new_password !== form.confirmation) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    if (form.current_password === form.new_password) {
      setError("Usa una contraseña diferente a la actual.");
      return;
    }

    const actualizado = await onChangePassword({
      current_password: form.current_password,
      new_password: form.new_password,
    });
    if (actualizado) {
      setForm({ current_password: "", new_password: "", confirmation: "" });
    }
  };

  return (
    <>
      <PageHead
        eyebrow="Seguridad"
        title="Cambia tu contraseña"
        text="Actualiza el acceso desde una sesión abierta. Al guardar, deberás iniciar sesión otra vez."
      />
      <section className="admin-panel max-w-xl">
        <div className="security-intro flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
          <span className="security-icon"><ShieldCheck size={20} /></span>
          <div>
            <strong>Acceso del administrador</strong>
            <p>La clave debe tener al menos 8 caracteres. No compartas el código maestro de recuperación.</p>
          </div>
        </div>
        <form className="formulario security-form grid gap-4" onSubmit={guardar}>
          <div className="campo">
            <label htmlFor="current-password">Contraseña actual</label>
            <input
              id="current-password"
              type="password"
              minLength={8}
              value={form.current_password}
              autoComplete="current-password"
              onChange={(event) => actualizarCampo("current_password", event.target.value)}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="new-password">Nueva contraseña</label>
            <input
              id="new-password"
              type="password"
              minLength={8}
              value={form.new_password}
              autoComplete="new-password"
              onChange={(event) => actualizarCampo("new_password", event.target.value)}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="confirm-password">Repite la nueva contraseña</label>
            <input
              id="confirm-password"
              type="password"
              minLength={8}
              value={form.confirmation}
              autoComplete="new-password"
              onChange={(event) => actualizarCampo("confirmation", event.target.value)}
              required
            />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-principal" type="submit"><LockKeyhole size={17} />Actualizar contraseña</button>
        </form>
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
      <PageHead eyebrow="Reportes" title="Números del mes" text="Ingresos, asistencia y servicios con mayor movimiento." />
      <div className="admin-metrics report-metrics">
        <article><span>Generado</span><strong>{dinero(safe.income || 0)}</strong><small>{safe.attended || 0} completadas</small></article>
        <article><span>Proyectado</span><strong>{dinero(safe.projected_income || 0)}</strong><small>{safe.booked || 0} reservadas</small></article>
        <article><span>Ticket promedio</span><strong>{dinero(safe.average_ticket || 0)}</strong><small>Por visita</small></article>
        <article><span>Asistencia</span><strong>{safe.attendance_rate || 0}%</strong><small>{safe.noshow || 0} ausencias</small></article>
      </div>
      <div className="reports-grid">
        <section className="admin-panel">
          <div className="admin-panel-head"><div><span>Demanda</span><h2>Servicios más pedidos</h2></div></div>
          <div className="chart-list">
            {serviceBreakdown.map((item) => (
              <article key={item.name}>
                <div><strong>{item.name}</strong><span>{item.count} citas | {dinero(item.income)}</span></div>
                <div className="chart-track"><i style={{ width: `${Math.max((item.count / maxServicio) * 100, 6)}%` }} /></div>
              </article>
            ))}
            {serviceBreakdown.length === 0 && <EmptyState text="Aún no hay datos para este mes." />}
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-head"><div><span>Ingresos</span><h2>Movimiento diario</h2></div></div>
          <div className="chart-list">
            {dailyIncome.map((item) => (
              <article key={item.day}>
                <div><strong>Día {item.day}</strong><span>{item.count} citas | {dinero(item.income)}</span></div>
                <div className="chart-track"><i style={{ width: `${Math.max((item.income / maxDia) * 100, 6)}%` }} /></div>
              </article>
            ))}
            {dailyIncome.length === 0 && <EmptyState text="Aún no hay ingresos completados." />}
          </div>
        </section>
      </div>
    </>
  );
}

function Actividad({ items = [] }) {
  const labels = {
    "appointment.created": "Cita creada",
    "appointment.status_changed": "Estado actualizado",
    "appointment.cancelled": "Cita cancelada",
    "appointment.rescheduled": "Cita reprogramada",
    "schedule.blocked": "Horario bloqueado",
    "availability.created": "Ausencia programada",
    "availability.deleted": "Ausencia eliminada",
    "business_hours.updated": "Horario semanal actualizado",
    "service.created": "Servicio creado",
    "service.updated": "Servicio actualizado",
    "security.password_reset": "Contraseña recuperada",
    "security.password_changed": "Contraseña actualizada",
  };

  return (
    <>
      <PageHead
        eyebrow="Bitácora"
        title="Actividad de la cuenta"
        text="Cada cambio importante de tu agenda queda registrado."
      />
      <section className="admin-panel audit-list">
        {items.map((item) => (
          <article key={item.id}>
            <span className="history-icon"><History size={17} /></span>
            <div>
              <strong>{labels[item.action] || item.action}</strong>
              <span>{item.entity_type}</span>
            </div>
            <time dateTime={item.created_at}>{fechaHumana(item.created_at)}</time>
          </article>
        ))}
        {items.length === 0 && (
          <EmptyState text="La actividad aparecerá aquí con los próximos cambios." />
        )}
      </section>
    </>
  );
}

function EmptyState({ text }) {
  return <div className="admin-empty"><CalendarDays size={24} /><span>{text}</span></div>;
}
