import Login from "./admin/AdminLogin";
import { lazy, Suspense } from "react";
import { recursosDeSeccion } from "../hooks/useAdminData";
const Bloqueos = lazy(() => import("./admin/AdminBlocks"));
const Servicios = lazy(() => import("./admin/AdminServices"));
const Horarios = lazy(() => import("./admin/AdminHours"));
const Seguridad = lazy(() => import("./admin/AdminSecurity"));
const Reportes = lazy(() => import("./admin/AdminReports"));
const Actividad = lazy(() => import("./admin/AdminActivity"));
const Equipo = lazy(() => import("./admin/AdminTeam"));

import { LogOut, Scissors, RefreshCw, Plus } from "lucide-react";
import AdminNavigation from "./admin/AdminNavigation";
import AppearanceControl from "./ui/AppearanceControl";

import AdminAgenda from "./admin/AdminAgenda";
const AdminClients = lazy(() => import("./admin/AdminClients"));
import AdminDashboard from "./admin/AdminDashboard";
const AdminGallery = lazy(() => import("./admin/AdminGallery"));
const AdminReviews = lazy(() => import("./admin/AdminReviews"));
const AdminWaitlist = lazy(() => import("./admin/AdminWaitlist"));
const AdminOperations = lazy(() => import("./admin/AdminOperations"));


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
  onAvisar,
}) {
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
          <AppearanceControl compact />
          <div><strong>{admin.perfil?.name || "Sebastián"}</strong><small>{admin.perfil?.role || "Administrador"}</small></div>
          <button className="icon-btn labeled-action" type="button" onClick={onSalir} aria-label="Cerrar sesión" title="Cerrar sesión">
            <LogOut size={18} /><span>Salir</span>
          </button>
        </div>
      </header>

      <div className="admin-layout">
        <AdminNavigation seccion={admin.tab} onSeleccionar={onTab} puedeGestionarEquipo={admin.perfil.can_manage_team} />

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
          {admin.tab === "servicios" && <Servicios servicios={admin.servicios} onGuardar={onGuardarServicio} puedeEditar={admin.perfil.can_manage_services ?? admin.perfil.username === "sebas"} />}
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
          {admin.tab === "seguridad" && <Seguridad token={admin.token} onChangePassword={onChangePassword} />}
          {admin.tab === "equipo" && admin.perfil.can_manage_team && <Equipo items={admin.equipo} token={admin.token} onSaved={onRefresh} avisar={onAvisar} />}
          </Suspense>}
        </main>
      </div>
    </section>
  );
}
