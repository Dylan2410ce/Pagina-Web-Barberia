import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Mail,
  Phone,
  Search,
  Scissors,
  UserRound,
} from "lucide-react";
import {
  claseEstado,
  dinero,
  fechaHumana,
  textoEstado,
} from "../../utils/format";
import AdminPageHead from "./AdminPageHead";

function coincide(cliente, query) {
  const term = query.trim().toLocaleLowerCase("es-CR");
  if (!term) return true;
  const content = [
    cliente.name,
    cliente.phone,
    cliente.email,
    ...(cliente.history || []).map((item) => item.service),
  ].join(" ").toLocaleLowerCase("es-CR");
  return content.includes(term);
}

export default function AdminClients({ clientes = [] }) {
  const [query, setQuery] = useState("");
  const [seleccionado, setSeleccionado] = useState("");
  const visibles = useMemo(
    () => clientes.filter((cliente) => coincide(cliente, query)),
    [clientes, query],
  );
  const clienteActivo = clientes.find((cliente) => cliente.phone === seleccionado) || visibles[0];

  return (
    <>
      <AdminPageHead
        eyebrow="Clientes"
        title="Historial de cortes"
        text="Encuentra a un cliente y revisa sus visitas, servicios y notas."
      />

      <div className="clients-workspace">
        <section className="admin-panel clients-directory">
          <div className="filter-search">
            <Search size={17} />
            <input
              value={query}
              placeholder="Buscar por nombre, teléfono o servicio"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="clients-directory-head">
            <span>{visibles.length} clientes</span>
            <span>{clientes.reduce((total, item) => total + item.appointments, 0)} visitas registradas</span>
          </div>
          <div className="clients-list">
            {visibles.length === 0 && (
              <div className="admin-empty"><UserRound size={24} /><span>No encontramos coincidencias.</span></div>
            )}
            {visibles.map((cliente) => (
              <button
                className={`client-directory-row ${clienteActivo?.phone === cliente.phone ? "activo" : ""}`}
                key={cliente.phone}
                type="button"
                onClick={() => setSeleccionado(cliente.phone)}
              >
                <span className="client-avatar">{cliente.name?.slice(0, 1).toUpperCase()}</span>
                <span>
                  <strong>{cliente.name}</strong>
                  <small>{cliente.phone} · {cliente.appointments} citas</small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
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
                  <p>{clienteActivo.appointments} visitas · {dinero(clienteActivo.spent)} generado</p>
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
