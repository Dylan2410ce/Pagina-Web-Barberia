import { ArrowLeft, Scale, Scissors } from "lucide-react";

const pages = {
  "/privacidad": {
    eyebrow: "Privacidad",
    title: "Política de privacidad",
    intro: "Explicamos qué datos usamos cuando reservas y cómo puedes ejercer control sobre ellos.",
    sections: [
      {
        title: "Responsable y alcance",
        paragraphs: [
          "Sebas Barber administra la información ingresada en este sitio para coordinar citas con Sebastián o Gabriel. Esta política aplica al formulario de reserva, la consulta de citas y el panel administrativo.",
          "Para consultas sobre tus datos puedes escribir a sebasbarberg2021@gmail.com.",
        ],
      },
      {
        title: "Datos que recopilamos",
        paragraphs: [
          "Solicitamos nombre, teléfono, servicio, barbero, fecha y hora. El correo y las notas del corte son opcionales. No procesamos tarjetas ni pagos desde esta web.",
          "También conservamos el estado de la cita y su historial de cambios para operar la agenda y atender solicitudes de cancelación o reprogramación.",
        ],
      },
      {
        title: "Uso y servicios relacionados",
        paragraphs: [
          "Usamos los datos para reservar el espacio, evitar cruces de horario, contactar al cliente, mantener el historial de atención y preparar reportes internos del negocio.",
          "La operación utiliza proveedores tecnológicos de alojamiento, base de datos, calendario y correo. Cada proveedor recibe únicamente la información necesaria para prestar su servicio.",
        ],
      },
      {
        title: "Conservación y derechos",
        paragraphs: [
          "Conservamos la información mientras sea necesaria para administrar la relación con el cliente, respaldar la agenda y cumplir obligaciones aplicables. Después puede eliminarse o anonimizarse.",
          "Puedes solicitar acceso, corrección o eliminación de tus datos mediante el correo indicado. Atenderemos la solicitud después de verificar que corresponde a la persona titular.",
        ],
      },
      {
        title: "Marco aplicable",
        paragraphs: [
          "El tratamiento se realiza conforme a los principios de información, finalidad, seguridad y consentimiento de la Ley N.° 8968 de Costa Rica.",
        ],
        links: [
          {
            label: "Consultar Ley N.° 8968",
            href: "https://pgrweb.go.cr/scij/Busqueda/Normativa/Normas/nrm_texto_completo.aspx?nValor1=1&nValor2=70975&nValor3=85989",
          },
        ],
      },
    ],
  },
  "/terminos-reserva": {
    eyebrow: "Condiciones",
    title: "Términos de reserva",
    intro: "Estas reglas mantienen la agenda clara para clientes y barberos.",
    sections: [
      {
        title: "Confirmación de la cita",
        paragraphs: [
          "La reserva queda registrada cuando el sistema muestra el comprobante. Mientras aparezca como pendiente, el barbero puede revisarla y confirmarla desde su agenda.",
          "La disponibilidad se valida nuevamente al enviar el formulario. Si otra persona tomó ese espacio primero, deberás elegir una nueva hora.",
        ],
      },
      {
        title: "Servicios, duración y precio",
        paragraphs: [
          "El precio mostrado corresponde al servicio y los extras elegidos. Los extras suman al total, pero no amplían automáticamente el tiempo reservado.",
          "Los trabajos de color pueden requerir una valoración previa. Si el servicio necesita un ajuste importante de tiempo o precio, el barbero lo comunicará antes de realizarlo.",
        ],
      },
      {
        title: "Puntualidad y cambios",
        paragraphs: [
          "Te recomendamos llegar unos minutos antes. Una llegada tardía puede reducir el tiempo disponible o requerir reprogramación para no afectar las citas siguientes.",
          "Puedes consultar, cancelar o mover una cita desde la sección Mis citas usando el mismo teléfono de la reserva.",
        ],
      },
      {
        title: "Disponibilidad",
        paragraphs: [
          "Los horarios pueden cambiar por feriados, vacaciones, bloqueos internos o situaciones imprevistas. Cuando esto ocurra, la agenda pública dejará de ofrecer esos espacios.",
        ],
      },
    ],
  },
  "/aviso-cancelacion": {
    eyebrow: "Agenda",
    title: "Aviso de cancelación",
    intro: "Cancelar con tiempo permite que otra persona aproveche el espacio.",
    sections: [
      {
        title: "Cómo cancelar",
        paragraphs: [
          "Entra en Mis citas, escribe el teléfono utilizado al reservar y selecciona Cancelar. El horario se libera de inmediato en la agenda y en el calendario del barbero.",
          "Si la web no está disponible, contacta directamente al barbero por teléfono o WhatsApp.",
        ],
      },
      {
        title: "Reprogramaciones",
        paragraphs: [
          "Puedes mover una cita activa a cualquier espacio que aparezca disponible. El sistema vuelve a comprobar la base de datos y Google Calendar antes de guardar el cambio.",
        ],
      },
      {
        title: "Ausencias",
        paragraphs: [
          "Si no puedes asistir, avisa tan pronto como sea posible. Las ausencias quedan registradas para mantener un historial real de la agenda, pero esta web no aplica cargos automáticos por cancelación.",
        ],
      },
    ],
  },
};

export default function LegalPage({ path }) {
  const page = pages[path] || pages["/privacidad"];

  return (
    <main className="legal-page">
      <header className="legal-nav">
        <a className="marca" href="/">
          <span><Scissors size={19} /></span>
          <strong>Sebas Barber</strong>
        </a>
        <a className="btn btn-linea" href="/">
          <ArrowLeft size={17} />
          Volver
        </a>
      </header>
      <section className="legal-hero">
        <span className="eyebrow"><Scale size={14} />{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
        <small>Última actualización: julio de 2026</small>
      </section>
      <div className="legal-content">
        {page.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.links?.map((link) => (
              <a
                className="legal-source"
                href={link.href}
                key={link.href}
                target="_blank"
                rel="noreferrer"
              >
                {link.label}
              </a>
            ))}
          </section>
        ))}
      </div>
      <footer className="legal-footer">
        <a href="/privacidad">Privacidad</a>
        <a href="/terminos-reserva">Términos de reserva</a>
        <a href="/aviso-cancelacion">Cancelaciones</a>
      </footer>
    </main>
  );
}
