import { useEffect, useState } from "react";
import { BarChart3, BellRing, BriefcaseBusiness, CalendarCheck2, CalendarOff, ChevronDown, Clock3, History, Home, Images, LockKeyhole, MessageSquareQuote, MoreHorizontal, Scissors, Users } from "lucide-react";

const grupos = [
  { id: "dia", titulo: "Día a día", opciones: [
    { id: "resumen", titulo: "Hoy", icono: CalendarCheck2 },
    { id: "agenda", titulo: "Agenda", icono: Clock3 },
    { id: "bloqueos", titulo: "Bloquear agenda", icono: CalendarOff },
    { id: "clientes", titulo: "Clientes", icono: Users },
    { id: "espera", titulo: "Lista de espera", icono: BellRing },
  ] },
  { id: "negocio", titulo: "Negocio", opciones: [
    { id: "reportes", titulo: "Reportes", icono: BarChart3 },
    { id: "operacion", titulo: "Caja y configuración", icono: BriefcaseBusiness },
    { id: "servicios", titulo: "Servicios", icono: Scissors },
    { id: "horarios", titulo: "Horario semanal", icono: Clock3 },
    { id: "equipo", titulo: "Equipo", icono: Users, propietario: true },
  ] },
  { id: "contenido", titulo: "Contenido", opciones: [
    { id: "galeria", titulo: "Galería", icono: Images },
    { id: "resenas", titulo: "Reseñas", icono: MessageSquareQuote },
  ] },
  { id: "cuenta", titulo: "Mi cuenta", opciones: [
    { id: "actividad", titulo: "Actividad", icono: History },
    { id: "seguridad", titulo: "Seguridad e integraciones", icono: LockKeyhole },
  ] },
];

export default function AdminNavigation({ seccion, onSeleccionar, puedeGestionarEquipo = false }) {
  const grupoActivo = grupos.find((grupo) => grupo.opciones.some((opcion) => opcion.id === seccion))?.id || "dia";
  const [abiertos, setAbiertos] = useState(() => new Set(["dia", grupoActivo]));
  const [mas, setMas] = useState(false);
  useEffect(() => {
    setAbiertos((actuales) => new Set([...actuales, grupoActivo]));
    setMas(false);
  }, [grupoActivo, seccion]);

  const elegir = (id) => { setMas(false); onSeleccionar(id); };
  const opciones = (grupo) => grupo.opciones.filter((opcion) => !opcion.propietario || puedeGestionarEquipo).map(({ id, titulo, icono: Icono }) => (
    <button type="button" key={id} className={seccion === id ? "activo" : ""} aria-current={seccion === id ? "page" : undefined} onClick={() => elegir(id)}>
      <Icono size={18} aria-hidden="true" /><span>{titulo}</span>
    </button>
  ));

  return <>
    <nav className="admin-mobile-navigation" aria-label="Accesos del panel">
      <div className="admin-mobile-tabs">
        {[grupos[0].opciones[0], grupos[0].opciones[2], grupos[0].opciones[3]].map(({ id, titulo, icono: Icono }) => <button type="button" key={id} aria-current={seccion === id ? "page" : undefined} onClick={() => elegir(id)}><Icono size={19} aria-hidden="true" /><span>{id === "bloqueos" ? "Bloquear" : titulo}</span></button>)}
        <button type="button" aria-expanded={mas} aria-controls="admin-mobile-more" onClick={() => setMas((actual) => !actual)}><MoreHorizontal size={19} aria-hidden="true" /><span>Más</span></button>
      </div>
      {mas && <div className="admin-mobile-more" id="admin-mobile-more">{grupos.map((grupo) => <section key={grupo.id}><h2>{grupo.titulo}</h2>{opciones(grupo)}</section>)}</div>}
    </nav>
    <aside className="admin-sidebar">
      <nav aria-label="Secciones del panel">{grupos.map((grupo) => <div className="admin-nav-group" key={grupo.id}>
        <button type="button" className="admin-group-toggle" aria-expanded={abiertos.has(grupo.id)} aria-controls={`admin-group-${grupo.id}`} onClick={() => setAbiertos((actuales) => { const siguientes = new Set(actuales); if (siguientes.has(grupo.id)) siguientes.delete(grupo.id); else siguientes.add(grupo.id); return siguientes; })}><span>{grupo.titulo}</span><ChevronDown size={16} aria-hidden="true" /></button>
        {abiertos.has(grupo.id) && <div id={`admin-group-${grupo.id}`} className="admin-group-options">{opciones(grupo)}</div>}
      </div>)}</nav>
      <a href="/"><Home size={18} aria-hidden="true" /><span>Volver a la web</span></a>
    </aside>
  </>;
}
