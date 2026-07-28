import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Gift,
  Mail,
  Phone,
  Search,
  Scissors,
  Save,
  ShieldOff,
  Tags,
  UserRound,
} from "lucide-react";
import {
  claseEstado,
  dinero,
  fechaCorta,
  fechaHumana,
  fechaISOCR,
  textoEstado,
} from "../../utils/format";
import { descargarCsv } from "../../utils/csv";
import AdminPageHead from "./AdminPageHead";

const PAGE_SIZE = 8;

function coincide(cliente, query, status, desde) {
  const term = query.trim().toLocaleLowerCase("es-CR");
  const content = [
    cliente.name,
    cliente.phone,
    cliente.email,
    ...(cliente.history || []).map((item) => item.service),
  ].join(" ").toLocaleLowerCase("es-CR");
  const history = cliente.history || [];
  const statusMatch = !status || history.some((item) => item.status === status);
  const dateMatch = !desde || history.some(
    (item) => fechaISOCR(item.starts_at) >= desde,
  );
  return (!term || content.includes(term)) && statusMatch && dateMatch;
}

export default function AdminClients({
  clientes = [],
  onUpdate,
  onRedeem,
  onAnonymize,
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [desde, setDesde] = useState("");
  const [seleccionado, setSeleccionado] = useState("");
  const [pagina, setPagina] = useState(1);
  const visibles = useMemo(
    () => clientes.filter((cliente) => coincide(
      cliente,
      query,
      status,
      desde,
    )),
    [clientes, desde, query, status],
  );
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / PAGE_SIZE));
  const paginaVisible = visibles.slice(
    (pagina - 1) * PAGE_SIZE,
    pagina * PAGE_SIZE,
  );
  const clienteActivo = visibles.find(
    (cliente) => cliente.phone === seleccionado,
  ) || paginaVisible[0];
  const [profileForm, setProfileForm] = useState({
    tags: "",
    preferences: "",
    internal_notes: "",
  });

  useEffect(() => {
    setPagina(1);
    setSeleccionado("");
  }, [desde, query, status]);

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

  useEffect(() => {
    setProfileForm({
      tags: (clienteActivo?.tags || []).join(", "),
      preferences: clienteActivo?.preferences || "",
      internal_notes: clienteActivo?.internal_notes || "",
    });
  }, [
    clienteActivo?.internal_notes,
    clienteActivo?.phone,
    clienteActivo?.preferences,
    clienteActivo?.tags,
  ]);

  const exportar = () => descargarCsv(
    "clientes-sebas-barber.csv",
    visibles,
    [
      { label: "Nombre", value: (item) => item.name },
      { label: "Teléfono", value: (item) => item.phone },
      { label: "Correo", value: (item) => item.email },
      { label: "Citas", value: (item) => item.appointments },
      { label: "Visitas completadas", value: (item) => item.completed_appointments },
      { label: "Última visita", value: (item) => item.last_visit ? fechaHumana(item.last_visit) : "" },
      { label: "Servicio favorito", value: (item) => item.favorite_service },
      { label: "Total generado", value: (item) => item.spent },
    ],
  );

  return (
    <>
      <AdminPageHead
        eyebrow="Clientes"
        title="Historial de cortes"
        text="Encuentra a un cliente y revisa sus visitas, servicios y notas."
        action={(
          <button
            className="btn btn-linea"
            type="button"
            onClick={exportar}
            disabled={visibles.length === 0}
          >
            <Download size={17} />
            Exportar CSV
          </button>
        )}
      />

      <div className="clients-workspace">
        <section className="admin-panel clients-directory">
          <div className="admin-filters clients-filters">
            <div className="filter-search">
              <Search size={17} />
              <input
                value={query}
                placeholder="Nombre, teléfono o servicio"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <select
              value={status}
              aria-label="Filtrar clientes por estado"
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos los estados</option>
              {["pending", "confirmed", "completed", "no_show", "cancelled"].map((item) => (
                <option value={item} key={item}>{textoEstado(item)}</option>
              ))}
            </select>
            <input
              type="date"
              value={desde}
              aria-label="Filtrar clientes desde una fecha"
              onChange={(event) => setDesde(event.target.value)}
            />
          </div>
          <div className="clients-directory-head">
            <span>{visibles.length} clientes</span>
            <span>
              {visibles.reduce((total, item) => total + item.appointments, 0)}
              {" "}
              visitas registradas
            </span>
          </div>
          <div className="clients-list">
            {visibles.length === 0 && (
              <div className="admin-empty"><UserRound size={24} /><span>No encontramos coincidencias.</span></div>
            )}
            {paginaVisible.map((cliente) => (
              <button
                className={`client-directory-row ${clienteActivo?.phone === cliente.phone ? "activo" : ""}`}
                key={cliente.phone}
                type="button"
                onClick={() => setSeleccionado(cliente.phone)}
              >
                <span className="client-avatar">{cliente.name?.slice(0, 1).toUpperCase()}</span>
                <span>
                  <strong>{cliente.name}</strong>
                  <small>
                    {cliente.phone}
                    {" · "}
                    {cliente.appointments}
                    {" "}
                    {cliente.appointments === 1 ? "cita" : "citas"}
                  </small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          {visibles.length > PAGE_SIZE && (
            <nav className="pagination" aria-label="Páginas de clientes">
              <button
                className="icon-btn"
                type="button"
                onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
                disabled={pagina === 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={17} />
              </button>
              <span>Página {pagina} de {totalPaginas}</span>
              <button
                className="icon-btn"
                type="button"
                onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))}
                disabled={pagina === totalPaginas}
                aria-label="Página siguiente"
              >
                <ChevronRight size={17} />
              </button>
            </nav>
          )}
        </section>

        <section className="admin-panel client-history-panel">
          {!clienteActivo && (
            <div className="admin-empty">
              <CalendarDays size={25} />
              <span>Aún no hay clientes registrados.</span>
            </div>
          )}
          {clienteActivo && (
            <>
              <header className="client-profile-head">
                <span className="client-avatar grande">{clienteActivo.name?.slice(0, 1).toUpperCase()}</span>
                <div>
                  <span>Ficha del cliente</span>
                  <h2>{clienteActivo.name}</h2>
                  <p>{clienteActivo.completed_appointments || 0} visitas · {dinero(clienteActivo.spent)} generado</p>
                </div>
                <div className="client-contact-actions">
                  <a className="icon-btn" href={`tel:+506${clienteActivo.phone}`} aria-label={`Llamar a ${clienteActivo.name}`} title="Llamar">
                    <Phone size={17} />
                  </a>
                  {clienteActivo.email && (
                    <a className="icon-btn" href={`mailto:${clienteActivo.email}`} aria-label={`Enviar correo a ${clienteActivo.name}`} title="Correo">
                      <Mail size={17} />
                    </a>
                  )}
                </div>
              </header>
              <div className="client-insights">
                <article>
                  <span>Última visita</span>
                  <strong>{clienteActivo.last_visit ? fechaCorta(clienteActivo.last_visit) : "Sin completar"}</strong>
                </article>
                <article>
                  <span>Servicio habitual</span>
                  <strong>{clienteActivo.favorite_service || "Sin datos"}</strong>
                </article>
                <article>
                  <span>Frecuencia</span>
                  <strong>{clienteActivo.frequency_days ? `Cada ${clienteActivo.frequency_days} días` : "Por calcular"}</strong>
                </article>
                <article>
                  <span>No asistió</span>
                  <strong>{clienteActivo.no_show_count || 0} veces</strong>
                </article>
              </div>
              {clienteActivo.profile_id && (
                <form
                  className="client-profile-editor formulario"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onUpdate(clienteActivo.profile_id, {
                      tags: profileForm.tags
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                      preferences: profileForm.preferences.trim() || null,
                      internal_notes: profileForm.internal_notes.trim() || null,
                    });
                  }}
                >
                  <div className="campo">
                    <label htmlFor="client-tags"><Tags size={15} />Etiquetas</label>
                    <input
                      id="client-tags"
                      value={profileForm.tags}
                      placeholder="Frecuente, fade, puntual"
                      onChange={(event) => setProfileForm((current) => ({
                        ...current,
                        tags: event.target.value,
                      }))}
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="client-preferences">Preferencias del corte</label>
                    <textarea
                      id="client-preferences"
                      rows="2"
                      maxLength="600"
                      value={profileForm.preferences}
                      placeholder="Máquina, estilo habitual o detalles que conviene recordar"
                      onChange={(event) => setProfileForm((current) => ({
                        ...current,
                        preferences: event.target.value,
                      }))}
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="client-notes-admin">Notas privadas</label>
                    <textarea
                      id="client-notes-admin"
                      rows="2"
                      maxLength="1000"
                      value={profileForm.internal_notes}
                      onChange={(event) => setProfileForm((current) => ({
                        ...current,
                        internal_notes: event.target.value,
                      }))}
                    />
                  </div>
                  <div className="client-profile-actions">
                    <button className="btn btn-principal" type="submit">
                      <Save size={16} />
                      Guardar ficha
                    </button>
                    {clienteActivo.loyalty_available > 0 && (
                      <button
                        className="btn btn-linea"
                        type="button"
                        onClick={() => onRedeem(clienteActivo)}
                      >
                        <Gift size={16} />
                        Canjear beneficio ({clienteActivo.loyalty_available})
                      </button>
                    )}
                    <button
                      className="btn btn-peligro"
                      type="button"
                      onClick={() => onAnonymize(clienteActivo)}
                    >
                      <ShieldOff size={16} />
                      Eliminar datos personales
                    </button>
                  </div>
                </form>
              )}
              <div className="client-history-list">
                {(clienteActivo.history || []).map((visita) => (
                  <article key={visita.id}>
                    <span className="history-icon"><Scissors size={17} /></span>
                    <div>
                      <span className={claseEstado(visita.status)}>{textoEstado(visita.status)}</span>
                      <h3>{visita.service}</h3>
                      {visita.addons?.length > 0 && <p>Extras: {visita.addons.join(", ")}</p>}
                      {visita.notes && <p className="history-note">Nota: {visita.notes}</p>}
                    </div>
                    <div>
                      <strong>{fechaHumana(visita.starts_at)}</strong>
                      <span>{dinero(visita.total_price)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
