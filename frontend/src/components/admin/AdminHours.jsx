import { diasSemana, minutosAHora } from "../../utils/format";
import PageHead from "./AdminPageHead";


export default function Horarios({ horarios, onGuardar }) {
  return (
    <>
      <PageHead eyebrow="Semana" title="Horario de reservas" text="Los clientes solo verán horas dentro de estos rangos." />
      <section className="admin-panel">
        <div className="business-hours-list">
          {horarios.map((hora) => (
            <form className="business-hour-row" key={hora.weekday} onSubmit={(event) => onGuardar(event, hora.weekday)}>
              <strong>{diasSemana[hora.weekday]}</strong>
              <label className="toggle-line"><input name="is_open" type="checkbox" defaultChecked={hora.is_open} /><span>Abierto</span></label>
              <label><span>Abre</span><input name="open_time" type="time" defaultValue={minutosAHora(hora.open_min)} /></label>
              <label><span>Cierra</span><input name="close_time" type="time" defaultValue={minutosAHora(hora.close_min)} /></label>
              <button className="btn btn-secundario" type="submit">Guardar</button>
            </form>
          ))}
        </div>
      </section>
    </>
  );
}
