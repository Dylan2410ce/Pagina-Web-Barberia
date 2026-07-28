import { HelpCircle } from "lucide-react";

const questions = [
  {
    question: "¿Cuánto dura una cita?",
    answer: "La mayoría de los servicios dura 45 minutos. Los tratamientos especiales muestran su duración exacta antes de reservar.",
  },
  {
    question: "¿Los extras agregan tiempo?",
    answer: "No. Los extras cambian el precio, pero se realizan dentro del tiempo reservado para el servicio principal.",
  },
  {
    question: "¿Puedo mover o cancelar mi cita?",
    answer: "Sí. Usa el código privado que recibes al reservar desde la sección Mis citas.",
  },
  {
    question: "¿Qué pasa si el día está lleno?",
    answer: "Puedes entrar a la lista de espera. El barbero verá tu solicitud si se libera un horario.",
  },
  {
    question: "¿Necesito crear una cuenta?",
    answer: "No. Solo necesitas tus datos de contacto y conservar el código de la reserva.",
  },
];

export default function FaqSection() {
  return (
    <section id="preguntas" className="seccion bloque faq-section">
      <div className="cabecera-seccion reveal">
        <div>
          <span className="eyebrow"><HelpCircle size={14} />Antes de reservar</span>
          <h2>Lo que conviene saber.</h2>
          <p>Respuestas rápidas para llegar con todo claro.</p>
        </div>
      </div>
      <div className="faq-list reveal">
        {questions.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
