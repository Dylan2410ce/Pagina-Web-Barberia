import { useEffect, useRef, useState } from "react";
import { CalendarPlus, CircleCheckBig } from "lucide-react";
import { adminApi, publicoApi } from "../../api/client";
import { nuevaReserva, nuevoRequestId } from "../../utils/bookingDraft";
import { dinero, fechaHumana, hoyISO, limpiarTelefono } from "../../utils/format";
import { validarNombre, validarTelefono } from "../../utils/validation";
import Dialog from "../ui/Dialog";
import FormField from "../ui/FormField";

export default function ManualAppointment({ admin, onClose, onCreated }) {
  const [reserva, setReserva] = useState(() => ({ ...nuevaReserva(false), barber_id: admin.perfil.id }));
  const [servicios, setServicios] = useState(admin.servicios || []);
  const [slots, setSlots] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [errorHorarios, setErrorHorarios] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [incierto, setIncierto] = useState(false);
  const [cita, setCita] = useState(null);
  const [intento, setIntento] = useState(0);
  const pendiente = useRef(null);
  const bloqueo = useRef(false);
  const servicio = servicios.find((item) => item.id === reserva.service_id);
  const extras = servicios.filter((item) => item.is_addon && item.is_active);
  const subtotal = (servicio?.price || 0) + extras.filter((item) => reserva.addon_ids.includes(item.id)).reduce((sum, item) => sum + item.price, 0);
  useEffect(() => {
    let activo = true;
    adminApi.servicios(admin.token).then((items) => { if (activo) setServicios(items); }).catch((err) => { if (activo) setError(err.message); });
    return () => { activo = false; };
  }, [admin.token, intento]);
  useEffect(() => {
    let activo = true;
    setSlots([]);
    setErrorHorarios("");
    if (!reserva.service_id || !reserva.date) { setCargando(false); return; }
    setCargando(true);
    publicoApi.disponibilidad({ barberId: admin.perfil.id, serviceId: reserva.service_id, fecha: reserva.date })
      .then((items) => { if (activo) setSlots(items); })
      .catch((err) => { if (activo) setErrorHorarios(err.message); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [admin.perfil.id, reserva.service_id, reserva.date, intento]);
  const cambiar = (campo, valor) => setReserva((prev) => ({ ...prev, [campo]: valor, request_id: nuevoRequestId(), ...(["service_id", "date"].includes(campo) ? { start_min: null } : {}) }));
  const guardar = async (event) => {
    event?.preventDefault();
    if (bloqueo.current) return;
    if (!pendiente.current && (validarNombre(reserva.client_name) || validarTelefono(reserva.client_phone) || reserva.start_min === null)) { setError("Revisa el nombre, teléfono y horario antes de guardar."); return; }
    const payload = pendiente.current || { ...reserva, client_email: reserva.client_email.trim() || null, notes: reserva.notes.trim() || null };
    bloqueo.current = true; setEnviando(true); setError("");
    try {
      const creada = await adminApi.crearCita(admin.token, payload);
      pendiente.current = null; setIncierto(false); setCita(creada);
      void onCreated(creada);
    } catch (err) {
      const sinConfirmacion = err instanceof TypeError || [408, 500, 502, 503, 504].includes(err.status);
      if (sinConfirmacion) { pendiente.current = payload; setIncierto(true); setError("No recibimos la confirmación. Comprueba esta misma reserva antes de crear otra."); }
      else {
        pendiente.current = null; setIncierto(false); setError(err.message);
        if (err.status === 409) { cambiar("start_min", null); setIntento((prev) => prev + 1); }
      }
    } finally { bloqueo.current = false; setEnviando(false); }
  };
  return <Dialog title={cita ? "Cita guardada" : "Nueva cita"} onClose={() => { if (!enviando && !incierto) onClose(); }}>
    {cita ? <div className="manual-success"><CircleCheckBig size={32} /><h3>{cita.client_name}</h3><p>{cita.service_name} · {fechaHumana(cita.starts_at)}</p><strong>{dinero(cita.total_price)}</strong><p>Código de reserva</p><code>{cita.access_code}</code><button type="button" className="btn btn-principal" onClick={onClose}>Volver a la agenda</button></div> : <form className="formulario manual-appointment" onSubmit={guardar}>
      {(error || errorHorarios) && <div className="booking-notice" role="alert"><p>{error || errorHorarios}</p>{incierto ? <button type="button" className="btn btn-principal" disabled={enviando} onClick={() => guardar()}>Comprobar reserva</button> : <button type="button" className="text-action" onClick={() => { setError(""); setIntento((prev) => prev + 1); }}>Actualizar horarios y servicios</button>}</div>}
      <fieldset className="wizard-fields formulario" disabled={enviando || incierto}>
        <legend className="sr-only">Datos de la cita</legend>
        <p>Agenda de <strong>{admin.perfil.name}</strong></p>
        <div className="campo"><label htmlFor="manual-service">Servicio</label><select id="manual-service" required value={reserva.service_id} onChange={(e) => cambiar("service_id", e.target.value)}><option value="">Selecciona un servicio</option>{servicios.filter((item) => item.is_active && !item.is_addon).map((item) => <option key={item.id} value={item.id}>{item.name} · {dinero(item.price)}</option>)}</select></div>
        {extras.length > 0 && <details><summary>Extras opcionales</summary>{extras.map((extra) => <label className="remember-contact" key={extra.id}><input type="checkbox" checked={reserva.addon_ids.includes(extra.id)} onChange={(e) => cambiar("addon_ids", e.target.checked ? [...reserva.addon_ids, extra.id] : reserva.addon_ids.filter((id) => id !== extra.id))} />{extra.name} · {dinero(extra.price)}</label>)}</details>}
        <FormField id="manual-date" type="date" label="Fecha" value={reserva.date} min={hoyISO()} required onChange={(e) => cambiar("date", e.target.value)} />
        <div className="campo"><span id="manual-hour-label">Hora</span><div className="slots" role="group" aria-labelledby="manual-hour-label">{cargando ? <p role="status">Consultando horarios…</p> : slots.map((slot) => <button className={`slot ${reserva.start_min === slot.start_min ? "activo" : ""}`} aria-pressed={reserva.start_min === slot.start_min} type="button" key={slot.start_min} onClick={() => cambiar("start_min", slot.start_min)}>{slot.label}</button>)}{!cargando && !errorHorarios && servicio && !slots.length && <p>No hay espacios disponibles. Elige otra fecha.</p>}</div></div>
        <FormField id="manual-name" label="Nombre del cliente" required value={reserva.client_name} maxLength={80} validate={validarNombre} onChange={(e) => cambiar("client_name", e.target.value)} />
        <FormField id="manual-phone" label="Teléfono" required value={reserva.client_phone} inputMode="tel" maxLength={8} validate={validarTelefono} onChange={(e) => cambiar("client_phone", limpiarTelefono(e.target.value))} />
        <FormField id="manual-email" label="Correo (opcional)" type="email" value={reserva.client_email} onChange={(e) => cambiar("client_email", e.target.value)} />
        <FormField id="manual-notes" label="Notas (opcional)" maxLength={240} value={reserva.notes} onChange={(e) => cambiar("notes", e.target.value)} />
        <p className="manual-total">Subtotal sin promociones <strong>{dinero(subtotal)}</strong></p>
        <button type="submit" className="btn btn-principal" disabled={reserva.start_min === null || cargando}><CalendarPlus size={18} />{enviando ? "Guardando…" : "Guardar cita"}</button>
      </fieldset>
    </form>}
  </Dialog>;
}
