import { useEffect, useState } from "react";
import {
  BellRing,
  CalendarClock,
  ChartNoAxesCombined,
  CircleDollarSign,
  Database,
  Gift,
  MessageSquareText,
  Plus,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import { diasSemana, dinero, hoyISO, minutosAHora } from "../../utils/format";
import AdminPageHead from "./AdminPageHead";

const views = [
  { id: "config", label: "Configuración", icon: Settings2 },
  { id: "pausas", label: "Pausas", icon: CalendarClock },
  { id: "promos", label: "Promociones", icon: Gift },
  { id: "finanzas", label: "Finanzas", icon: CircleDollarSign },
  { id: "calidad", label: "Calidad", icon: MessageSquareText },
];

function toMinutes(value) {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  return hours * 60 + minutes;
}

export default function AdminOperations({
  data = {},
  services = [],
  onSaveSettings,
  onCreateBreak,
  onDeleteBreak,
  onCreatePromotion,
  onTogglePromotion,
  onDeletePromotion,
  onCreateExpense,
  onDeleteExpense,
  onCreateCashClose,
  onDownloadBackup,
}) {
  const [view, setView] = useState("config");
  const [settings, setSettings] = useState(data.settings || {});
  const [breakForm, setBreakForm] = useState({
    weekday: 1,
    start: "12:00",
    end: "13:00",
    label: "Almuerzo",
  });
  const [promotion, setPromotion] = useState({
    name: "",
    service_id: "",
    start_date: hoyISO(),
    end_date: hoyISO(),
    discount_type: "fixed",
    discount_value: 1000,
  });
  const [expense, setExpense] = useState({
    expense_date: hoyISO(),
    category: "Insumos",
    description: "",
    amount: "",
  });
  const [close, setClose] = useState({
    business_date: hoyISO(),
    notes: "",
  });

  useEffect(() => {
    setSettings(data.settings || {});
  }, [data.settings]);

  const submitBreak = async (event) => {
    event.preventDefault();
    const saved = await onCreateBreak({
      weekday: Number(breakForm.weekday),
      start_min: toMinutes(breakForm.start),
      end_min: toMinutes(breakForm.end),
      label: breakForm.label,
      is_active: true,
    });
    if (saved) setBreakForm((current) => ({ ...current, label: "Almuerzo" }));
  };

  const submitPromotion = async (event) => {
    event.preventDefault();
    const saved = await onCreatePromotion({
      ...promotion,
      service_id: promotion.service_id || null,
      discount_value: Number(promotion.discount_value),
      is_active: true,
    });
    if (saved) setPromotion((current) => ({ ...current, name: "" }));
  };

  const submitExpense = async (event) => {
    event.preventDefault();
    const saved = await onCreateExpense({
      ...expense,
      amount: Number(expense.amount),
    });
    if (saved) setExpense((current) => ({
      ...current,
      description: "",
      amount: "",
    }));
  };

  return (
    <>
      <AdminPageHead
        eyebrow="Operación"
        title="El negocio, en orden"
        text="Ajusta tu agenda, sigue los números y cuida la experiencia de tus clientes."
        action={(
          <button className="btn btn-linea" type="button" onClick={onDownloadBackup}>
            <Database size={17} />
            Descargar respaldo
          </button>
        )}
      />
      <nav className="operations-tabs" aria-label="Herramientas del negocio">
        {views.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={view === item.id ? "activo" : ""}
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
            >
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {view === "config" && (
        <section className="admin-panel operations-form">
          <header>
            <div>
              <span>Preferencias de agenda</span>
              <h2>Reglas del servicio</h2>
            </div>
          </header>
          <form
            className="formulario operations-grid"
            onSubmit={(event) => {
              event.preventDefault();
              onSaveSettings({
                email: settings.email || null,
                cancellation_notice_hours: Number(settings.cancellation_notice_hours),
                reschedule_notice_hours: Number(settings.reschedule_notice_hours),
                appointment_buffer_min: Number(settings.appointment_buffer_min),
                daily_summary_enabled: Boolean(settings.daily_summary_enabled),
                parking_info: settings.parking_info || null,
                directions_hint: settings.directions_hint || null,
                public_message: settings.public_message || null,
              });
            }}
          >
            <div className="campo">
              <label htmlFor="settings-email">Correo de avisos</label>
              <input
                id="settings-email"
                type="email"
                value={settings.email || ""}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  email: event.target.value,
                }))}
              />
            </div>
            <div className="campo">
              <label htmlFor="cancel-hours">Anticipación para cancelar (horas)</label>
              <input
                id="cancel-hours"
                type="number"
                min="0"
                max="72"
                value={settings.cancellation_notice_hours ?? 2}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  cancellation_notice_hours: event.target.value,
                }))}
              />
            </div>
            <div className="campo">
              <label htmlFor="move-hours">Anticipación para mover (horas)</label>
              <input
                id="move-hours"
                type="number"
                min="0"
                max="72"
                value={settings.reschedule_notice_hours ?? 2}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  reschedule_notice_hours: event.target.value,
                }))}
              />
            </div>
            <div className="campo">
              <label htmlFor="buffer-minutes">Tiempo entre citas (minutos)</label>
              <input
                id="buffer-minutes"
                type="number"
                min="0"
                max="60"
                value={settings.appointment_buffer_min ?? 0}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  appointment_buffer_min: event.target.value,
                }))}
              />
            </div>
            <div className="campo span-2">
              <label htmlFor="public-message">Aviso visible en tu perfil (opcional)</label>
              <input
                id="public-message"
                maxLength="240"
                value={settings.public_message || ""}
                placeholder="Ej.: Esta semana atendemos hasta las 6:00 p. m."
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  public_message: event.target.value,
                }))}
              />
            </div>
            <div className="campo">
              <label htmlFor="parking-info">Estacionamiento</label>
              <input
                id="parking-info"
                maxLength="240"
                value={settings.parking_info || ""}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  parking_info: event.target.value,
                }))}
              />
            </div>
            <div className="campo">
              <label htmlFor="directions-hint">Referencia para llegar</label>
              <input
                id="directions-hint"
                maxLength="240"
                value={settings.directions_hint || ""}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  directions_hint: event.target.value,
                }))}
              />
            </div>
            <label className="remember-contact span-2">
              <input
                type="checkbox"
                checked={Boolean(settings.daily_summary_enabled)}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  daily_summary_enabled: event.target.checked,
                }))}
              />
              Recibir el resumen diario por correo
            </label>
            <button className="btn btn-principal" type="submit">
              <Save size={17} />
              Guardar configuración
            </button>
          </form>
        </section>
      )}

      {view === "pausas" && (
        <div className="operations-split">
          <section className="admin-panel operations-form">
            <header><div><span>Horario recurrente</span><h2>Nueva pausa semanal</h2></div></header>
            <form className="formulario" onSubmit={submitBreak}>
              <div className="campo">
                <label htmlFor="break-day">Día</label>
                <select
                  id="break-day"
                  value={breakForm.weekday}
                  onChange={(event) => setBreakForm((current) => ({
                    ...current,
                    weekday: event.target.value,
                  }))}
                >
                  {diasSemana.map((day, index) => (
                    <option key={day} value={index}>{day}</option>
                  ))}
                </select>
              </div>
              <div className="form-doble">
                <div className="campo">
                  <label htmlFor="break-start">Desde</label>
                  <input
                    id="break-start"
                    type="time"
                    step="900"
                    value={breakForm.start}
                    onChange={(event) => setBreakForm((current) => ({
                      ...current,
                      start: event.target.value,
                    }))}
                  />
                </div>
                <div className="campo">
                  <label htmlFor="break-end">Hasta</label>
                  <input
                    id="break-end"
                    type="time"
                    step="900"
                    value={breakForm.end}
                    onChange={(event) => setBreakForm((current) => ({
                      ...current,
                      end: event.target.value,
                    }))}
                  />
                </div>
              </div>
              <div className="campo">
                <label htmlFor="break-label">Motivo</label>
                <input
                  id="break-label"
                  value={breakForm.label}
                  maxLength="80"
                  onChange={(event) => setBreakForm((current) => ({
                    ...current,
                    label: event.target.value,
                  }))}
                />
              </div>
              <button className="btn btn-principal" type="submit">
                <Plus size={17} />
                Añadir pausa
              </button>
            </form>
          </section>
          <section className="admin-panel operations-list">
            <header><div><span>Semana habitual</span><h2>Pausas activas</h2></div></header>
            {(data.breaks || []).map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{diasSemana[item.weekday]} · {item.label}</strong>
                  <span>{minutosAHora(item.start_min)} a {minutosAHora(item.end_min)}</span>
                </div>
                <button
                  className="icon-btn danger"
                  type="button"
                  onClick={() => onDeleteBreak(item)}
                  aria-label={`Eliminar ${item.label}`}
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
            {(data.breaks || []).length === 0 && <p className="admin-empty">No hay pausas recurrentes.</p>}
          </section>
        </div>
      )}

      {view === "promos" && (
        <div className="operations-split">
          <section className="admin-panel operations-form">
            <header><div><span>Oferta temporal</span><h2>Nueva promoción</h2></div></header>
            <form className="formulario" onSubmit={submitPromotion}>
              <div className="campo">
                <label htmlFor="promo-name">Nombre</label>
                <input
                  id="promo-name"
                  value={promotion.name}
                  minLength="3"
                  maxLength="120"
                  placeholder="Semana de regreso a clases"
                  onChange={(event) => setPromotion((current) => ({
                    ...current,
                    name: event.target.value,
                  }))}
                  required
                />
              </div>
              <div className="campo">
                <label htmlFor="promo-service">Servicio</label>
                <select
                  id="promo-service"
                  value={promotion.service_id}
                  onChange={(event) => setPromotion((current) => ({
                    ...current,
                    service_id: event.target.value,
                  }))}
                >
                  <option value="">Todos los servicios</option>
                  {services.filter((item) => !item.is_addon).map((item) => (
                    <option value={item.id} key={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-doble">
                <div className="campo">
                  <label htmlFor="promo-from">Desde</label>
                  <input
                    id="promo-from"
                    type="date"
                    value={promotion.start_date}
                    onChange={(event) => setPromotion((current) => ({
                      ...current,
                      start_date: event.target.value,
                    }))}
                  />
                </div>
                <div className="campo">
                  <label htmlFor="promo-to">Hasta</label>
                  <input
                    id="promo-to"
                    type="date"
                    value={promotion.end_date}
                    onChange={(event) => setPromotion((current) => ({
                      ...current,
                      end_date: event.target.value,
                    }))}
                  />
                </div>
              </div>
              <div className="form-doble">
                <div className="campo">
                  <label htmlFor="promo-type">Tipo</label>
                  <select
                    id="promo-type"
                    value={promotion.discount_type}
                    onChange={(event) => setPromotion((current) => ({
                      ...current,
                      discount_type: event.target.value,
                    }))}
                  >
                    <option value="fixed">Monto en colones</option>
                    <option value="percentage">Porcentaje</option>
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor="promo-value">Descuento</label>
                  <input
                    id="promo-value"
                    type="number"
                    min="1"
                    max={promotion.discount_type === "percentage" ? 90 : 100000}
                    value={promotion.discount_value}
                    onChange={(event) => setPromotion((current) => ({
                      ...current,
                      discount_value: event.target.value,
                    }))}
                  />
                </div>
              </div>
              <button className="btn btn-principal" type="submit">
                <Plus size={17} />
                Publicar promoción
              </button>
            </form>
          </section>
          <section className="admin-panel operations-list">
            <header><div><span>Precios especiales</span><h2>Promociones</h2></div></header>
            {(data.promotions || []).map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.discount_type === "percentage"
                      ? `${item.discount_value}%`
                      : dinero(item.discount_value)}
                    {" · "}
                    {item.start_date} a {item.end_date}
                  </span>
                </div>
                <div className="inline-actions">
                  <button
                    className={`status-toggle ${item.is_active ? "activo" : ""}`}
                    type="button"
                    onClick={() => onTogglePromotion(item)}
                    aria-label={item.is_active ? "Desactivar promoción" : "Activar promoción"}
                  >
                    {item.is_active ? "Activa" : "Pausada"}
                  </button>
                  <button
                    className="icon-btn danger"
                    type="button"
                    onClick={() => onDeletePromotion(item)}
                    aria-label={`Eliminar ${item.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </section>
        </div>
      )}

      {view === "finanzas" && (
        <>
          <div className="operations-metrics">
            <article><ChartNoAxesCombined size={19} /><span>Ingresos brutos</span><strong>{dinero(data.metrics?.gross_income || 0)}</strong></article>
            <article><CircleDollarSign size={19} /><span>Gastos</span><strong>{dinero(data.metrics?.expenses || 0)}</strong></article>
            <article><ChartNoAxesCombined size={19} /><span>Ingreso neto</span><strong>{dinero(data.metrics?.net_income || 0)}</strong></article>
            <article><MessageSquareText size={19} /><span>Clientes recurrentes</span><strong>{data.metrics?.repeat_rate || 0}%</strong></article>
          </div>
          <div className="operations-split">
            <section className="admin-panel operations-form">
              <header><div><span>Control de caja</span><h2>Registrar gasto</h2></div></header>
              <form className="formulario" onSubmit={submitExpense}>
                <div className="form-doble">
                  <div className="campo">
                    <label htmlFor="expense-date">Fecha</label>
                    <input
                      id="expense-date"
                      type="date"
                      value={expense.expense_date}
                      onChange={(event) => setExpense((current) => ({
                        ...current,
                        expense_date: event.target.value,
                      }))}
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="expense-category">Categoría</label>
                    <select
                      id="expense-category"
                      value={expense.category}
                      onChange={(event) => setExpense((current) => ({
                        ...current,
                        category: event.target.value,
                      }))}
                    >
                      <option>Insumos</option>
                      <option>Alquiler</option>
                      <option>Servicios</option>
                      <option>Equipo</option>
                      <option>Otro</option>
                    </select>
                  </div>
                </div>
                <div className="campo">
                  <label htmlFor="expense-description">Detalle</label>
                  <input
                    id="expense-description"
                    value={expense.description}
                    maxLength="200"
                    onChange={(event) => setExpense((current) => ({
                      ...current,
                      description: event.target.value,
                    }))}
                    required
                  />
                </div>
                <div className="campo">
                  <label htmlFor="expense-amount">Monto</label>
                  <input
                    id="expense-amount"
                    type="number"
                    min="1"
                    value={expense.amount}
                    onChange={(event) => setExpense((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))}
                    required
                  />
                </div>
                <button className="btn btn-principal" type="submit">
                  <Plus size={17} />
                  Guardar gasto
                </button>
              </form>
              <hr />
              <form
                className="formulario"
                onSubmit={(event) => {
                  event.preventDefault();
                  onCreateCashClose(close);
                }}
              >
                <div className="campo">
                  <label htmlFor="close-date">Cierre del día</label>
                  <input
                    id="close-date"
                    type="date"
                    max={hoyISO()}
                    value={close.business_date}
                    onChange={(event) => setClose((current) => ({
                      ...current,
                      business_date: event.target.value,
                    }))}
                  />
                </div>
                <button className="btn btn-linea" type="submit">
                  <Save size={17} />
                  Cerrar caja
                </button>
              </form>
            </section>
            <section className="admin-panel operations-list">
              <header><div><span>Movimientos recientes</span><h2>Gastos</h2></div></header>
              {(data.expenses || []).slice(0, 20).map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.description}</strong>
                    <span>{item.expense_date} · {item.category}</span>
                  </div>
                  <strong>{dinero(item.amount)}</strong>
                  <button
                    className="icon-btn danger"
                    type="button"
                    onClick={() => onDeleteExpense(item)}
                    aria-label={`Eliminar ${item.description}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              ))}
              <header className="secondary-head"><div><span>Últimos cierres</span><h2>Caja</h2></div></header>
              {(data.cash_closes || []).slice(0, 10).map((item) => (
                <article key={item.id}>
                  <div><strong>{item.business_date}</strong><span>Neto del día</span></div>
                  <strong>{dinero(item.net_income)}</strong>
                </article>
              ))}
            </section>
          </div>
        </>
      )}

      {view === "calidad" && (
        <div className="operations-split">
          <section className="admin-panel operations-list">
            <header><div><span>Encuestas privadas</span><h2>Experiencia del cliente</h2></div></header>
            <div className="quality-summary">
              <span>Satisfacción <strong>{data.metrics?.average_satisfaction || 0}/5</strong></span>
              <span>Facilidad de reserva <strong>{data.metrics?.average_booking_ease || 0}/5</strong></span>
            </div>
            {(data.feedback || []).map((item) => (
              <article key={item.id}>
                <div>
                  <strong>Satisfacción {item.satisfaction}/5 · Reserva {item.booking_ease}/5</strong>
                  <span>{item.private_comment || "Sin comentario"}</span>
                </div>
              </article>
            ))}
          </section>
          <section className="admin-panel operations-list">
            <header><div><span>Correo automático</span><h2>Últimos envíos</h2></div></header>
            {(data.notifications || []).map((item) => (
              <article key={item.id}>
                <BellRing size={17} />
                <div>
                  <strong>{item.recipient_email}</strong>
                  <span>{item.kind.replaceAll("_", " ")} · {item.status}</span>
                  {item.last_error && <small>{item.last_error}</small>}
                </div>
              </article>
            ))}
          </section>
        </div>
      )}
    </>
  );
}
