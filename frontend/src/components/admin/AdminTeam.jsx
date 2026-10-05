import { useMemo, useRef, useState } from "react";
import { CalendarDays, Pencil, Plus, RotateCcw, UserMinus, Users } from "lucide-react";
import { adminApi } from "../../api/client";
import BarberPhoto from "../BarberPhoto";
import Dialog from "../ui/Dialog";
import FormField from "../ui/FormField";
import SearchToolbar from "../ui/SearchToolbar";
import AdminPageHead from "./AdminPageHead";

const perfilVacio = { name: "", role: "Barbero", username: "", password: "", phone: "", email: "", instagram_url: "", photo_url: "", public_message: "", calendar_sync: false, calendar_id: "" };
const camposPerfil = ["name", "role", "phone", "email", "instagram_url", "photo_url", "public_message", "calendar_sync", "calendar_id"];

export default function AdminTeam({ items = [], token, onSaved, avisar }) {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("activos");
  const [editor, setEditor] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const enCurso = useRef(false);
  const visibles = useMemo(() => items.filter((item) =>
    (estado === "todos" || item.is_active === (estado === "activos"))
    && `${item.name} ${item.username}`.toLocaleLowerCase("es-CR").includes(busqueda.toLocaleLowerCase("es-CR"))), [items, estado, busqueda]);
  const actualizar = (campo) => (event) => setEditor((actual) => ({ ...actual, [campo]: event.target.value }));
  const abrir = (item) => { setError(""); setEditor({ ...perfilVacio, ...item }); };
  const cerrar = () => { if (!enCurso.current) { setEditor(null); setConfirmacion(null); setError(""); } };

  const ejecutar = async (accion, mensaje) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setGuardando(true); setError("");
    try {
      await accion();
      setEditor(null); setConfirmacion(null);
      avisar?.("ok", mensaje);
      await onSaved?.();
    } catch (excepcion) {
      setError(excepcion.message);
    } finally { enCurso.current = false; setGuardando(false); }
  };
  const guardar = (event) => {
    event.preventDefault();
    const datos = Object.fromEntries(camposPerfil.map((campo) => [campo, editor[campo] ?? perfilVacio[campo]]));
    if (editor.id) void ejecutar(() => adminApi.editarBarbero(token, editor.id, datos), "Perfil actualizado");
    else void ejecutar(() => adminApi.crearBarbero(token, { ...datos, username: editor.username.trim().toLowerCase(), password: editor.password }), "Barbero añadido");
  };

  return <>
    <AdminPageHead eyebrow="Negocio" title="Tu equipo." text="Perfiles y acceso al panel. Cada barbero conserva su propia agenda." />
    <div className="team-admin-summary"><Users size={20} aria-hidden="true" /><span><strong>{items.filter((item) => item.is_active).length} barberos activos</strong><small>El mismo menú de servicios para todo el equipo.</small></span><button className="btn btn-principal" type="button" onClick={() => abrir(null)}><Plus size={18} />Añadir barbero</button></div>
    <SearchToolbar value={busqueda} onChange={setBusqueda} label="Buscar barbero" count={visibles.length}><select aria-label="Estado del equipo" value={estado} onChange={(event) => setEstado(event.target.value)}><option value="activos">Activos</option><option value="retirados">Retirados</option><option value="todos">Todos</option></select></SearchToolbar>
    <div className="team-admin-grid">{visibles.map((item) => <article className="team-admin-card" key={item.id}>
      <div className="team-admin-profile"><BarberPhoto nombre={item.name} foto={item.photo_url} compacta /><div><h2>{item.name}</h2><p>{item.role}</p><small>@{item.username}</small></div><span className={`estado ${item.is_active ? "estado-completed" : "estado-inactive"}`}>{item.is_active ? "Activo" : "Retirado"}</span></div>
      <p className="team-calendar-label"><CalendarDays size={17} aria-hidden="true" />{item.calendar_sync ? "Google Calendar" : "Agenda de la barbería"}</p>
      <div className="team-admin-actions"><button className="btn btn-linea" type="button" onClick={() => abrir(item)} aria-label={`Editar ${item.name}`}><Pencil size={17} />Editar perfil</button>{item.username !== "sebas" && <button className={`btn ${item.is_active ? "btn-peligro" : "btn-linea"}`} type="button" onClick={() => { setError(""); setConfirmacion(item); }}>{item.is_active ? <UserMinus size={17} /> : <RotateCcw size={17} />}{item.is_active ? "Retirar" : "Reactivar"}</button>}</div>
    </article>)}</div>
    {!visibles.length && <div className="admin-empty"><Users size={28} /><strong>No hay perfiles en esta vista.</strong><p>Prueba otra búsqueda o añade un barbero.</p></div>}
    {editor && <Dialog title={editor.id ? "Editar perfil" : "Añadir barbero"} onClose={cerrar}><form onSubmit={guardar} className="team-editor"><fieldset disabled={guardando}>
      <div className="form-doble"><FormField label="Nombre" required minLength={2} maxLength={80} value={editor.name} onChange={actualizar("name")} autoComplete="off" /><FormField label="Teléfono" required inputMode="tel" pattern="[24678][0-9]{7}" maxLength={8} value={editor.phone} onChange={actualizar("phone")} hint="8 dígitos, sin +506." /></div>
      {!editor.id && <div className="form-doble"><FormField label="Usuario de acceso" required minLength={3} maxLength={50} pattern="[a-z][a-z0-9_]{2,49}" value={editor.username} onChange={actualizar("username")} autoComplete="off" hint="Minúsculas, números o guion bajo." /><FormField label="Contraseña inicial" type="password" required minLength={12} maxLength={72} value={editor.password} onChange={actualizar("password")} autoComplete="new-password" hint="12 caracteres: mayúscula, minúscula, número y símbolo." validate={(valor) => /[A-Z]/.test(valor) && /[a-z]/.test(valor) && /[0-9]/.test(valor) && /[^A-Za-z0-9]/.test(valor) ? "" : "Incluye mayúscula, minúscula, número y símbolo."} /></div>}
      <FormField label="Correo para notificaciones" type="email" maxLength={160} value={editor.email || ""} onChange={actualizar("email")} />
      <details><summary>Perfil público y calendario</summary><div className="team-editor-details"><FormField label="Especialidad o cargo" required maxLength={80} value={editor.role} onChange={actualizar("role")} /><FormField label="Instagram (opcional)" type="url" value={editor.instagram_url || ""} onChange={actualizar("instagram_url")} placeholder="https://www.instagram.com/usuario/" /><FormField label="Foto (opcional)" value={editor.photo_url || ""} onChange={actualizar("photo_url")} hint="Ruta /assets/ o enlace de una foto de Cloudinary. Sin foto se muestran las iniciales." /><FormField label="Presentación breve (opcional)" maxLength={240} value={editor.public_message || ""} onChange={actualizar("public_message")} /><label className="check-line"><input type="checkbox" checked={editor.calendar_sync} onChange={(event) => setEditor((actual) => ({ ...actual, calendar_sync: event.target.checked }))} />Sincronizar con Google Calendar</label>{editor.calendar_sync && <FormField label="ID de Google Calendar" required value={editor.calendar_id || ""} onChange={actualizar("calendar_id")} hint="Comparte antes el calendario con la cuenta de servicio." />}</div></details>
      {!editor.id && <p className="team-editor-note">Horario inicial: martes a sábado, con pausa de almuerzo. El barbero puede ajustarlo en su panel.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-principal btn-ancho" type="submit">{guardando ? <><span className="spinner" />Guardando…</> : editor.id ? "Guardar cambios" : "Crear perfil"}</button>
    </fieldset></form></Dialog>}
    {confirmacion && <Dialog title={confirmacion.is_active ? `Retirar a ${confirmacion.name}` : `Reactivar a ${confirmacion.name}`} onClose={cerrar}><div className="team-retire-dialog"><p>{confirmacion.is_active ? "Dejará de aparecer en las reservas y perderá el acceso al panel. Su historial se conserva. Si tiene citas pendientes, deberá resolverlas primero." : "Volverá a aparecer en las reservas con su horario y sus datos anteriores."}</p>{error && <p role="alert" className="form-error">{error}</p>}<button className={`btn btn-ancho ${confirmacion.is_active ? "btn-peligro" : "btn-principal"}`} disabled={guardando} type="button" onClick={() => ejecutar(() => confirmacion.is_active ? adminApi.retirarBarbero(token, confirmacion.id) : adminApi.reactivarBarbero(token, confirmacion.id), confirmacion.is_active ? "Perfil retirado" : "Perfil reactivado")}>{guardando ? "Guardando…" : confirmacion.is_active ? "Confirmar retiro" : "Reactivar perfil"}</button><button type="button" className="btn btn-linea btn-ancho" disabled={guardando} onClick={cerrar}>Volver</button></div></Dialog>}
  </>;
}
