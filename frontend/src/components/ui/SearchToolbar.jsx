import { Search, X } from "lucide-react";

export default function SearchToolbar({ value, onChange, label = "Buscar", count, children }) {
  return (
    <div className="data-toolbar">
      <div className="data-search">
        <Search size={18} aria-hidden="true" />
        <input type="search" aria-label={label} placeholder={label} value={value} onChange={(event) => onChange(event.target.value)} />
        {value && <button type="button" className="search-clear" aria-label={`Limpiar ${label.toLowerCase()}`} title="Limpiar búsqueda" onClick={() => onChange("")}><X size={16} /><span>Limpiar</span></button>}
      </div>
      {children}
      {typeof count === "number" && <span className="data-count" role="status">{count} {count === 1 ? "resultado" : "resultados"}</span>}
    </div>
  );
}
