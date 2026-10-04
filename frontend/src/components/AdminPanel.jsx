import Login from "./admin/AdminLogin";
import { lazy, Suspense, useState } from "react";
import { recursosDeSeccion } from "../hooks/useAdminData";
const Bloqueos = lazy(() => import("./admin/AdminBlocks"));
const Servicios = lazy(() => import("./admin/AdminServices"));
const Horarios = lazy(() => import("./admin/AdminHours"));
const Seguridad = lazy(() => import("./admin/AdminSecurity"));
const Reportes = lazy(() => import("./admin/AdminReports"));
const Actividad = lazy(() => import("./admin/AdminActivity"));

import { BarChart3, BellRing, BriefcaseBusiness, CalendarCheck2, CalendarOff, Clock3, Home, History, Images, LayoutDashboard, LockKeyhole, LogOut, MessageSquareQuote, Scissors, Users, MoreHorizontal, RefreshCw, Plus } from "lucide-react";

import AdminAgenda from "./admin/AdminAgenda";
const AdminClients = lazy(() => import("./admin/AdminClients"));
import AdminDashboard from "./admin/AdminDashboard";
const AdminGallery = lazy(() => import("./admin/AdminGallery"));
const AdminReviews = lazy(() => import("./admin/AdminReviews"));
const AdminWaitlist = lazy(() => import("./admin/AdminWaitlist"));
const AdminOperations = lazy(() => import("./admin/AdminOperations"));


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
  onRefresh,
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
  onNuevaCita,
  onPreviewBloqueo,
}) {
  const [mas, setMas] = useState(false);
  const necesarios = recursosDeSeccion(admin.tab);
  const errores = necesarios.filter((clave) => admin.errores?.[clave]);
  const cargando = necesarios.some((clave) => admin.actualizados && !admin.actualizados[clave] && !admin.errores?.[clave]);
  const actualizacion = Math.min(...necesarios.map((clave) => admin.actualizados?.[clave] || 0));
  if (!admin.token) {
    return <Login onLogin={onLogin} onResetPassword={onResetPassword} />;
  }
  if (!admin.perfil) {
    return <section className="admin-boot" aria-busy={admin.cargando !== false}>
      <Scissors size={28} /><h1>Tu agenda</h1>
      {admin.errorCarga ? <><p>{admin.errorCarga}</p><button className="btn btn-principal" type="button" onClick={() => onRefresh?.()}>Volver a intentar</button><button className="btn btn-linea" type="button" onClick={onSalir}>Cerrar sesión</button></>
        : <><p role="status">Cargando tu panel…</p><div className="admin-boot-grid" aria-hidden="true">{[1, 2, 3, 4].map((id) => <span className="skeleton" key={id} />)}</div></>}
    </section>;
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
          <button className="icon-btn labeled-action" type="button" onClick={onSalir} aria-label="Cerrar sesión" title="Cerrar sesión">
            <LogOut size={18} /><span>Salir</span>
          </button>
        </div>
      </header>

      <div className="admin-layout">
        <nav className="admin-mobile-navigation" aria-label="Accesos del panel">
          <div className="admin-mobile-tabs">
            {[{ id: "resumen", label: "Hoy", icon: CalendarCheck2 }, { id: "bloqueos", label: "Bloquear", icon: CalendarOff }, { id: "clientes", label: "Clientes", icon: Users }].map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-current={admin.tab === id ? "page" : undefined} onClick={() => { onTab(id); setMas(false); }}><Icon size={19} /><span>{label}</span></button>)}
            <button type="button" aria-expanded={mas} aria-controls="admin-more-sections" onClick={() => setMas((valor) => !valor)}><MoreHorizontal size={19} /><span>Más</span></button>
          </div>
          {mas && <label id="admin-more-sections"><span>Ir a una sección</span>
          <select value={admin.tab} onChange={(event) => onTab(event.target.value)} aria-label="Sección del panel">
            {secciones.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          </label>}
        </nav>
        <aside className="admin-sidebar">
          <nav aria-label="Secciones del panel">
            {secciones.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className={admin.tab === item.id ? "activo" : ""}
                  key={item.id}
                  type="button"
                  aria-current={admin.tab === item.id ? "page" : undefined}
                  onClick={(event) => {
                    onTab(item.id);
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
          <div className="admin-sync-bar"><span>{actualizacion > 0 && Number.isFinite(actualizacion) ? `Actualizado a las ${new Date(actualizacion).toLocaleTimeString("es-CR", { hour: "numeric", minute: "2-digit" })}` : "Consultando tu agenda"}</span><button className="text-action" type="button" onClick={() => onRefresh?.()} disabled={admin.cargando || cargando}><RefreshCw size={16} />Actualizar</button>{onNuevaCita && <button className="btn btn-principal" type="button" onClick={onNuevaCita}><Plus size={18} />Nueva cita</button>}</div>
          {errores.length > 0 && <div className="booking-notice" role="alert"><strong>No pudimos actualizar esta sección</strong><p>{errores.map((clave) => admin.errores[clave]).join(" ")}</p><p>Los datos anteriores no se muestran para evitar confusiones.</p><button className="btn btn-linea" type="button" onClick={() => onRefresh?.()}>Volver a intentar</button></div>}
          {cargando && <div className="admin-section-loading" role="status"><span className="spinner" />Actualizando información…</div>}
          {!errores.length && !cargando && <Suspense fallback={<div className="admin-section-loading" role="status">Abriendo sección…</div>}>
          {admin.tab === "resumen" && (
            <AdminDashboard
              data={admin.dashboard}
              stats={admin.stats}
              operations={admin.operaciones?.metrics}
              perfil={admin.perfil}
              onTab={onTab}
              onBloqueoRapido={onBloqueoRapido}
              onEstado={onEstado}
              onMover={onMover}
              citas={admin.citas}
              fechaAgenda={admin.filtros.date}
              cargando={admin.cargandoAgenda}
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
              onPreview={onPreviewBloqueo}
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
          </Suspense>}
        </main>
      </div>
    </section>
  );
}
