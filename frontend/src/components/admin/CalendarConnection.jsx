import { useRef, useState } from "react";
import { CalendarCheck, LoaderCircle, RefreshCw } from "lucide-react";
import { adminApi } from "../../api/client";
import "../../styles/admin-integrations.css";

export default function CalendarConnection({ token }) {
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const pendiente = useRef(false);

  const comprobar = async () => {
    if (pendiente.current) return;
    pendiente.current = true;
    setCargando(true);
    try {
      setEstado(await adminApi.calendario(token));
    } catch (error) {
      setEstado({ available: false, message: error.message });
    } finally {
      pendiente.current = false;
      setCargando(false);
    }
  };

  return (
    <section className="admin-panel calendar-connection" aria-labelledby="calendar-connection-title">
      <div className="security-intro">
        <span className="security-icon"><CalendarCheck size={20} aria-hidden="true" /></span>
        <div>
          <h2 id="calendar-connection-title">Conexión de tu calendario</h2>
          <p>Comprueba que tu agenda de Google se puede consultar sin modificar ninguna cita.</p>
        </div>
      </div>
      <div className="calendar-connection-status" role="status" aria-live="polite">
        {cargando ? "Comprobando la conexión…" : estado?.read_access
          ? "Conexión verificada. Los permisos de edición se comprueban al guardar una cita."
          : estado?.message || (estado?.reason === "disabled" ? "La sincronización está desactivada para tu agenda." : estado ? "Revisa las credenciales y el calendario configurados en Render." : "Todavía no se ha comprobado la conexión.")}
      </div>
      <button type="button" className="btn btn-secundario" onClick={comprobar} disabled={cargando}>
        {cargando ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : <RefreshCw size={17} aria-hidden="true" />}
        {cargando ? "Comprobando…" : "Comprobar conexión"}
      </button>
    </section>
  );
}
