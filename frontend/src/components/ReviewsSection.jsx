import { Quote, Star } from "lucide-react";

function Rating({ value }) {
  return (
    <span className="review-stars" aria-label={`${value} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={16}
          aria-hidden="true"
          fill={index < value ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

export default function ReviewsSection({ reviews = [] }) {
  if (!reviews.length) return null;
  const average = reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length;

  return (
    <section id="resenas" className="seccion bloque reviews-section">
      <div className="cabecera-seccion reveal">
        <div>
          <span className="eyebrow">Reseñas verificadas</span>
          <h2>La opinión después del corte.</h2>
          <p>Comentarios de clientes que completaron una cita en Sebas Barber.</p>
        </div>
        <div className="reviews-average" aria-label={`Calificación promedio ${average.toFixed(1)} de 5`}>
          <strong>{average.toFixed(1)}</strong>
          <span><Rating value={Math.round(average)} />{reviews.length} opiniones</span>
        </div>
      </div>
      <div className="reviews-grid reveal">
        {reviews.slice(0, 6).map((review) => (
          <article className="review-card" key={review.id}>
            <Quote size={22} aria-hidden="true" />
            <Rating value={review.rating} />
            <blockquote>{review.comment}</blockquote>
            <footer>
              <strong>{review.client_name}</strong>
              <span>Cita con {review.barber_name || "Sebas Barber"}</span>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
