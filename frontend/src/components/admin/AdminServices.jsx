import { useState } from "react";
import { Pencil, Plus, Save, Scissors } from "lucide-react";
import { dinero } from "../../utils/format";
import { coincideBusqueda } from "../../utils/validation";
import PageHead from "./AdminPageHead";
import Dialog from "../ui/Dialog";
import EmptyState from "../ui/EmptyState";
import FormField from "../ui/FormField";
import SearchToolbar from "../ui/SearchToolbar";

function Editor({ servicio, onGuardar, onClose }) {
  const [extra, setExtra] = useState(Boolean(servicio.is_addon));
  const [guardando, setGuardando] = useState(false);
  const guardar = async (event) => {
    event.preventDefault();
    if (guardando) return;
    setGuardando(true);
    try { if (await onGuardar(event, servicio.id || null)) onClose(); }
    finally { setGuardando(false); }
  };
  return (
    <Dialog title={servicio.id ? "Editar servicio" : "Nuevo servicio"} onClose={onClose}>
      <form className="formulario" onSubmit={guardar}>
        <FormField name="name" label="Nombre del servicio" defaultValue={servicio.name || ""} maxLength={120} required />
        <div className="form-doble">
          <FormField name="price" label="Precio (₡)" type="number" min="0" max="1000000" step="1" defaultValue={servicio.price ?? 6000} required />
          <FormField name="duration_min" label="Duración (minutos)" type="number" min={extra ? 0 : 1} max="360" defaultValue={servicio.duration_min ?? 45} required />
        </div>
        <label className="toggle-line"><input name="is_addon" type="checkbox" checked={extra} onChange={(event) => setExtra(event.target.checked)} /><span>Extra opcional</span></label>
        {servicio.id && <label className="toggle-line"><input name="is_active" type="checkbox" defaultChecked={servicio.is_active} /><span>Disponible para reservar</span></label>}
        <div className="modal-actions"><button type="button" className="btn btn-linea" onClick={onClose} disabled={guardando}>Cancelar</button><button className="btn btn-principal" type="submit" disabled={guardando}>{guardando ? <span className="spinner" /> : <Save size={17} />}Guardar servicio</button></div>
      </form>
    </Dialog>
  );
}

export default function Servicios({ servicios = [], onGuardar }) {
  const [consulta, setConsulta] = useState("");
  const [estado, setEstado] = useState("");
  const [editor, setEditor] = useState(null);
  const visibles = servicios.filter((item) => coincideBusqueda([item.name], consulta)
    && (!estado || (estado === "extras" ? item.is_addon : estado === "activos" ? item.is_active : !item.is_active)));
  return (
    <>
      <PageHead eyebrow="Catálogo" title="Servicios y precios" text="El menú de Sebastián y Gabriel." action={<button className="btn btn-principal" type="button" onClick={() => setEditor({})}><Plus size={18} />Nuevo servicio</button>} />
      <SearchToolbar value={consulta} onChange={setConsulta} label="Buscar servicio" count={visibles.length}>
        <select value={estado} onChange={(event) => setEstado(event.target.value)} aria-label="Filtrar servicios"><option value="">Todos</option><option value="activos">Disponibles</option><option value="inactivos">Ocultos</option><option value="extras">Extras</option></select>
      </SearchToolbar>
      <div className="service-directory">
        {visibles.map((servicio) => <article key={servicio.id}>
          <span className="service-directory-icon"><Scissors size={20} /></span>
          <div><h2>{servicio.name}</h2><span>{servicio.is_addon ? "Extra opcional" : `${servicio.duration_min} min`} · {servicio.is_active ? "Disponible" : "Oculto"}</span></div>
          <strong>{dinero(servicio.price)}</strong>
          <button className="icon-btn" type="button" title={`Editar ${servicio.name}`} aria-label={`Editar ${servicio.name}`} onClick={() => setEditor(servicio)}><Pencil size={17} /></button>
        </article>)}
        {!visibles.length && <EmptyState />}
      </div>
      {editor && <Editor servicio={editor} onGuardar={onGuardar} onClose={() => setEditor(null)} />}
    </>
  );
}
