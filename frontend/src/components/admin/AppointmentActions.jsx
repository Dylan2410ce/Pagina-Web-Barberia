import { Check, CalendarCheck2, MoveRight, UserX, XCircle } from "lucide-react";
import ActionMenu from "../ui/ActionMenu";

export default function AppointmentActions({ cita, onEstado, onMover }) {
  const bloqueo = cita.status === "blocked";
  if (!["pending", "confirmed", "blocked"].includes(cita.status)) return null;
  return (
    <div className="appointment-actions">
      {cita.status === "pending" && <button className="btn btn-principal" type="button" onClick={() => onEstado(cita.id, "confirmed")}><CalendarCheck2 size={17} />Confirmar</button>}
      {cita.status === "confirmed" && <>
        <button className="btn btn-success" type="button" onClick={() => onEstado(cita.id, "completed")}><Check size={18} />Atendido</button>
        <button className="btn btn-peligro" type="button" onClick={() => onEstado(cita.id, "no_show")}><UserX size={17} />No llegó</button>
      </>}
      <ActionMenu label={`Acciones de ${bloqueo ? "bloqueo" : cita.client_name}`} actions={[
        ...(!bloqueo ? [{ label: "Reprogramar", icon: MoveRight, onClick: () => onMover(cita) }] : []),
        { label: bloqueo ? "Liberar horario" : "Cancelar cita", icon: XCircle, danger: true, onClick: () => onEstado(cita.id, "cancelled") },
      ]} />
    </div>
  );
}
