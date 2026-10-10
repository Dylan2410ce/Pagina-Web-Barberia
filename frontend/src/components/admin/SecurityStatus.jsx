import { useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { adminApi } from "../../api/client";

export default function SecurityStatus({ token }) {
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const pendiente = useRef(false);
  const comprobar = async () => {
    if (pendiente.current) return;
    pendiente.current = true; setCargando(true); setError("");
    try { setResultado(await adminApi.seguridad(token)); }
    catch (fallo) { setError(fallo.message); }
    finally { pendiente.current = false; setCargando(false); }
  };
  return <details className="security-diagnostics">
    <summary>Estado de seguridad</summary>
    <p>Comprueba el aislamiento de agendas en la base de datos.</p>
    <button type="button" className="btn btn-linea" disabled={cargando} onClick={comprobar}>
      <ShieldCheck size={18} aria-hidden="true" />{cargando ? "Comprobando…" : "Comprobar seguridad"}
    </button>
    {error && <p role="alert" className="form-error">{error}</p>}
    {resultado && <p role="status">{resultado.row_security.enforced
      ? `Aislamiento activo en ${resultado.row_security.tables} tablas.`
      : resultado.row_security.role_bypasses_rls
        ? "La API protege las agendas, pero el usuario de PostgreSQL puede omitir RLS. El propietario debe revisar sus permisos."
        : "Falta verificar las políticas RLS de PostgreSQL. Revisa las migraciones."}</p>}
  </details>;
}
