import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import AdminPanel from "../AdminPanel";
import ConfirmDialog from "../ConfirmDialog";
import RescheduleModal from "../RescheduleModal";
import Toasts from "../Toasts";
import useAdminController from "../../hooks/useAdminController";
import useClientBookings from "../../hooks/useClientBookings";
import { adminApi } from "../../api/client";

const ManualAppointment = lazy(() => import("./ManualAppointment"));
const nada = () => {};

export default function AdminWorkspace() {
  const [procesando, setProcesando] = useState("");
  const [toasts, setToasts] = useState([]);
  const [confirmacion, setConfirmacion] = useState(null);
  const [modalReprogramar, setModalReprogramar] = useState(null);
  const [manual, setManual] = useState(false);
  const avisar = useCallback((tipo, titulo, mensaje = "") => {
    setToasts((items) => [...items.slice(-2), { id: crypto.randomUUID(), tipo, titulo, mensaje }]);
  }, []);
  const control = useAdminController({ avisar, setProcesando, setConfirmacion });
  const { admin, cargarAdmin } = control;
  const { abrirReprogramar, cambiarFechaModal, confirmarReprogramacion } = useClientBookings({
    admin, modalReprogramar, avisar, setProcesando, setModalReprogramar, cargarAdmin, cargarSlots: nada,
  });
  useEffect(() => { if (admin.token) void cargarAdmin(); }, []);

  const props = {
    admin, onRefresh: () => cargarAdmin(), onLogin: control.loginAdmin,
    onResetPassword: control.resetPassword, onSalir: control.cerrarAdmin,
    onTab: control.cambiarTabAdmin, onFiltrar: control.filtrarAdmin,
    onEstado: control.solicitarEstadoAdmin, onMover: (cita) => abrirReprogramar(cita, "admin"),
    onNuevaCita: () => setManual(true),
    onPreviewBloqueo: (data) => adminApi.previsualizarBloqueo(admin.token, data),
    onBloqueo: control.crearBloqueo, onAusencia: control.crearAusencia,
    onEliminarAusencia: control.eliminarAusencia, onGuardarServicio: control.guardarServicio,
    onGuardarHorario: control.guardarHorario, onChangePassword: control.cambiarPassword,
    onBloqueoRapido: control.bloquearProximoEspacio, onEstadoListaEspera: control.cambiarEstadoListaEspera,
    onModerarReseña: control.moderarReseña, onCrearImagen: control.crearImagenGaleria,
    onSubirImagen: control.subirImagenGaleria, onEditarImagen: control.editarImagenGaleria,
    onEliminarImagen: control.eliminarImagenGaleria, onGuardarConfiguracion: control.guardarConfiguracion,
    onCrearPausa: control.crearPausa, onEliminarPausa: control.eliminarPausa,
    onCrearPromocion: control.crearPromocion, onAlternarPromocion: control.alternarPromocion,
    onEliminarPromocion: control.eliminarPromocion, onCrearGasto: control.crearGasto,
    onEliminarGasto: control.eliminarGasto, onCrearCierre: control.crearCierre,
    onDescargarRespaldo: control.descargarRespaldo, onActualizarCliente: control.actualizarCliente,
    onAnonimizarCliente: control.anonimizarCliente,
  };
  return <div className="admin-route">
    <AdminPanel {...props} />
    {manual && admin.perfil && <Suspense fallback={<div role="status">Abriendo formulario…</div>}><ManualAppointment admin={admin} onClose={() => setManual(false)} onCreated={() => cargarAdmin()} /></Suspense>}
    <RescheduleModal data={modalReprogramar} onClose={() => setModalReprogramar(null)} onDate={cambiarFechaModal} onSlot={(start_min) => setModalReprogramar((prev) => ({ ...prev, start_min }))} onConfirm={confirmarReprogramacion} />
    <ConfirmDialog config={confirmacion} onCancel={() => setConfirmacion(null)} onConfirm={() => { const accion = confirmacion?.onConfirm; setConfirmacion(null); accion?.(); }} />
    {procesando && <div className="loader-global" role="status" aria-live="polite"><div><span className="spinner grande" /><p>{procesando}</p></div></div>}
    <Toasts items={toasts} onClose={(id) => setToasts((items) => items.filter((item) => item.id !== id))} />
  </div>;
}
