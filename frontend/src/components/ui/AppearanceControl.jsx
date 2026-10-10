import { useId } from "react";
import { SunMoon } from "lucide-react";
import useAppearance from "../../hooks/useAppearance";

export default function AppearanceControl({ compact = false }) {
  const id = useId();
  const [preferencia, cambiar] = useAppearance();
  return <div className="appearance-control">
    <label htmlFor={id}><SunMoon size={16} aria-hidden="true" />{compact ? "Tema" : "Apariencia"}</label>
    <select id={id} value={preferencia} onChange={(event) => cambiar(event.target.value)}>
      <option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option>
    </select>
  </div>;
}
