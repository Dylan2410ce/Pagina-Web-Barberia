import { Check, MessageSquareQuote, Star, X } from "lucide-react";
import AdminPageHead from "./AdminPageHead";
import { useState } from "react";
import SearchToolbar from "../ui/SearchToolbar";
import { coincideBusqueda } from "../../utils/validation";

function Stars({ value }) {
  return (
    <span className="review-stars" aria-label={`${value} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} size={15} fill={index < value ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

export default function AdminReviews({ items = [], onStatus }) {
  const pending = items.filter((item) => item.status === "pending").length;
  const [consulta, setConsulta] = useState("");
  const [estado, setEstado] = useState("");
  const visibles = items.filter((item) => (!estado || item.status === estado) && coincideBusqueda([item.client_name, item.comment], consulta));
  return (
    <>
      <AdminPageHead
        eyebrow="Reseñas"
        title="Comentarios de clientes"
        text="Publica opiniones auténticas y archiva lo que no corresponda."
      />
      <section className="admin-panel reviews-admin">
        <div className="admin-panel-head">
          <div><span>Por revisar</span><h2>{pending} pendientes</h2></div>
          <strong>{items.length}</strong>
        </div>
        <div className="admin-review-list">
          <SearchToolbar value={consulta} onChange={setConsulta} label="Buscar reseña" count={visibles.length}><select value={estado} onChange={(event) => setEstado(event.target.value)} aria-label="Estado de reseñas"><option value="">Todos los estados</option><option value="pending">Pendientes</option><option value="approved">Publicadas</option><option value="rejected">Archivadas</option></select></SearchToolbar>
          {visibles.length === 0 && (
            <div className="admin-empty">
              <MessageSquareQuote size={25} />
              <strong>No hay reseñas con estos filtros.</strong>
            </div>
          )}
          {visibles.map((item) => (
            <article key={item.id}>
              <header>
                <div>
                  <strong>{item.client_name}</strong>
                  <Stars value={item.rating} />
                </div>
                <span className={`estado review-status-${item.status}`}>
                  {item.status === "pending"
                    ? "Pendiente"
                    : item.status === "approved"
                      ? "Publicada"
                      : "Archivada"}
                </span>
              </header>
              <blockquote>{item.comment}</blockquote>
              <div className="admin-review-actions">
                {item.status !== "approved" && (
                  <button className="btn btn-success" type="button" onClick={() => onStatus(item.id, "approved")}>
                    <Check size={16} />
                    Publicar
                  </button>
                )}
                {item.status !== "rejected" && (
                  <button className="btn btn-linea" type="button" onClick={() => onStatus(item.id, "rejected")}>
                    <X size={16} />
                    Archivar
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
