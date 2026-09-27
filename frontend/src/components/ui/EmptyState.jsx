import { SearchX } from "lucide-react";

export default function EmptyState({ text = "No hay resultados con estos filtros." }) {
  return <div className="admin-empty"><SearchX size={24} aria-hidden="true" /><span>{text}</span></div>;
}
