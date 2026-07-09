import React from "react";
import { CalendarDays, Check, Clock3, UserRound } from "lucide-react";
import { api, cleanPhone, money, today } from "../lib/api";
import { isClosedDay, serviceGroup } from "../utils/business";

export function Booking({ data, selectedServiceId }) {
  const [form, setForm] = React.useState({
    barber_id: data.barbers[0]?.id || "",
    service_id: data.services[0]?.id || "",
    addon_ids: [],
    date: today(),
    start_min: "",
    client_name: "",
    client_phone: "",
  });
  const [slots, setSlots] = React.useState([]);
  const [slotsLoading, setSlotsLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [errors, setErrors] = React.useState({});

  const selectedBarber = data.barbers.find((item) => item.id === form.barber_id);
  const selectedService = data.services.find((item) => item.id === form.service_id);
  const selectedAddons = data.addons.filter((item) => form.addon_ids.includes(item.id));
  const duration = (selectedService?.duration_min || 0) + selectedAddons.reduce((sum, item) => sum + item.duration_min, 0);
  const total = (selectedService?.price || 0) + selectedAddons.reduce((sum, item) => sum + item.price, 0);
  const selectedSlot = slots.find((slot) => String(slot.start_min) === String(form.start_min));
  const phoneValid = /^[24678][0-9]{7}$/.test(form.client_phone);
  const nameValid = /^[\p{L}\s]{3,60}$/u.test(form.client_name.trim());
  const closedSelectedDate = isClosedDay(form.date);
  const canSubmit = form.barber_id && form.service_id && form.date && form.start_min && form.client_name && form.client_phone && !closedSelectedDate && !saving;
  const progress = [
    Boolean(form.barber_id),
    Boolean(form.service_id),
    Boolean(form.date && form.start_min && !closedSelectedDate),
    Boolean(nameValid && phoneValid),
  ].filter(Boolean).length;

  const loadSlots = React.useCallback(async () => {
    if (!form.barber_id || !form.service_id || !form.date) return;
    if (isClosedDay(form.date)) {
      setSlotsLoading(false);
      setSlots([]);
      setForm((current) => ({ ...current, start_min: "" }));
      return;
    }

    setSlotsLoading(true);
    const params = new URLSearchParams({
      barber_id: form.barber_id,
      service_id: form.service_id,
      date: form.date,
    });
    form.addon_ids.forEach((id) => params.append("addon_ids", id));

    try {
      const items = await api(`/api/public/availability?${params}`);
      setSlots(items);
      setForm((current) => (
        items.some((slot) => String(slot.start_min) === String(current.start_min))
          ? current
          : { ...current, start_min: "" }
      ));
    } catch {
      setSlots([]);
      setForm((current) => ({ ...current, start_min: "" }));
    } finally {
      setSlotsLoading(false);
    }
  }, [form.barber_id, form.service_id, form.date, form.addon_ids.join(",")]);

  React.useEffect(() => {
    if (!selectedServiceId || selectedServiceId === form.service_id) return;
    if (!data.services.some((item) => item.id === selectedServiceId)) return;
    setMessage("Servicio seleccionado desde el menu.");
    setErrors({});
    setForm((current) => ({ ...current, service_id: selectedServiceId, start_min: "" }));
  }, [selectedServiceId, data.services, form.service_id]);

  React.useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  React.useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") loadSlots();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", loadSlots);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", loadSlots);
    };
  }, [loadSlots]);

  function toggleAddon(id) {
    setMessage("");
    setForm((current) => ({
      ...current,
      start_min: "",
      addon_ids: current.addon_ids.includes(id)
        ? current.addon_ids.filter((item) => item !== id)
        : [...current.addon_ids, id],
    }));
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!nameValid) nextErrors.client_name = "Escribe un nombre real, minimo 3 letras.";
    if (!phoneValid) nextErrors.client_phone = "Usa un numero de Costa Rica de 8 digitos.";
    if (!form.start_min) nextErrors.start_min = "Selecciona una hora disponible.";
    if (closedSelectedDate) nextErrors.start_min = "Domingo y lunes permanecemos cerrados.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("Revisa los datos marcados antes de confirmar.");
      return;
    }

    setSaving(true);
    setMessage("Guardando tu cita...");
    try {
      await api("/api/public/appointments", {
        method: "POST",
        body: JSON.stringify({ ...form, start_min: Number(form.start_min) }),
      });
      setMessage("Listo. Tu cita quedo reservada.");
      setSlots((current) => current.filter((slot) => String(slot.start_min) !== String(form.start_min)));
      setForm((current) => ({ ...current, start_min: "", client_name: "", client_phone: "" }));
      await loadSlots();
    } catch (error) {
      setMessage(error.message || "Ese horario acaba de ser tomado.");
      await loadSlots();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="reservar" className="section booking-section" data-reveal>
      <div className="booking-card">
        <div className="section-heading compact">
          <span className="eyebrow"><CalendarDays size={16} /> Reserva</span>
          <h2>Agenda tu cita en menos de un minuto.</h2>
          <p>Elige barbero, servicio y hora disponible. Al confirmar, ese espacio se bloquea para todos.</p>
        </div>

        <div className="booking-progress" style={{ "--progress": `${progress * 25}%` }}>
          <span>{progress}/4 listo</span>
          <b />
        </div>

        <form onSubmit={submit}>
          <label>Barbero</label>
          <div className="barber-grid">
            {data.barbers.map((barber) => (
              <button
                type="button"
                className={form.barber_id === barber.id ? "barber-choice active" : "barber-choice"}
                onClick={() => {
                  setMessage("");
                  setForm({ ...form, barber_id: barber.id, start_min: "" });
                }}
                key={barber.id}
              >
                <span>{barber.name.slice(0, 1)}</span>
                <b>{barber.name}</b>
                <small>{barber.role}</small>
              </button>
            ))}
          </div>

          <label>Servicio</label>
          <div className="service-select-row">
            <select
              value={form.service_id}
              onChange={(event) => {
                setMessage("");
                setForm({ ...form, service_id: event.target.value, start_min: "" });
              }}
            >
              {data.services.map((service) => (
                <option value={service.id} key={service.id}>
                  {service.name} / {money(service.price)} / {service.duration_min} min
                </option>
              ))}
            </select>
            <div className="selected-service-mini">
              <span>{serviceGroup(selectedService)}</span>
              <b>{selectedService?.name}</b>
              <small>{selectedService?.duration_min} min / {money(selectedService?.price)}</small>
            </div>
          </div>

          {!!data.addons.length && (
            <>
              <label>Extras</label>
              <div className="pill-grid">
                {data.addons.map((addon) => (
                  <button
                    type="button"
                    className={form.addon_ids.includes(addon.id) ? "active" : ""}
                    onClick={() => toggleAddon(addon.id)}
                    key={addon.id}
                  >
                    {addon.name} <small>{money(addon.price)}</small>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="form-grid">
            <div>
              <label>Fecha</label>
              <input
                type="date"
                min={today()}
                value={form.date}
                onChange={(event) => {
                  setMessage("");
                  setForm({ ...form, date: event.target.value, start_min: "" });
                }}
              />
            </div>
            <div>
              <label>Cliente</label>
              <input
                placeholder="Nombre completo"
                value={form.client_name}
                onChange={(event) => {
                  setErrors({ ...errors, client_name: "" });
                  setForm({ ...form, client_name: event.target.value });
                }}
                required
              />
              {errors.client_name && <small className="field-error">{errors.client_name}</small>}
            </div>
          </div>

          <label>Hora disponible</label>
          <div className="availability-line">
            <span>
              {closedSelectedDate
                ? "Cerrado domingo y lunes"
                : slotsLoading
                  ? "Actualizando agenda..."
                  : `${slots.length} espacios disponibles`}
            </span>
            {selectedSlot && <b>{selectedSlot.label} seleccionado</b>}
          </div>
          <div className="slots-grid">
            {slotsLoading && <span className="slot-note">Buscando espacios...</span>}
            {!slotsLoading && closedSelectedDate && (
              <span className="slot-note">La barberia abre de martes a sabado. Elige otro dia.</span>
            )}
            {!slotsLoading && !closedSelectedDate && slots.map((slot) => (
              <button
                type="button"
                className={String(form.start_min) === String(slot.start_min) ? "active" : ""}
                onClick={() => {
                  setMessage("");
                  setForm({ ...form, start_min: slot.start_min });
                }}
                key={slot.start_min}
              >
                <Clock3 size={15} /> {slot.label}
              </button>
            ))}
            {!slotsLoading && !closedSelectedDate && slots.length === 0 && (
              <span className="slot-note">No hay espacios para esa fecha. Prueba otro dia o servicio.</span>
            )}
          </div>
          {errors.start_min && <small className="field-error">{errors.start_min}</small>}

          <div className="form-grid align-end">
            <div>
              <label>Telefono</label>
              <input
                placeholder="88887777"
                value={form.client_phone}
                inputMode="numeric"
                onChange={(event) => {
                  setErrors({ ...errors, client_phone: "" });
                  setForm({ ...form, client_phone: cleanPhone(event.target.value) });
                }}
                required
              />
              {errors.client_phone && <small className="field-error">{errors.client_phone}</small>}
            </div>
            <button className="btn btn-primary submit-btn" disabled={!canSubmit}>
              {saving ? <span className="spinner" /> : <Check size={18} />} {saving ? "Reservando..." : "Confirmar cita"}
            </button>
          </div>

          {message && <p className={message.includes("Listo") ? "message success" : "message"}>{message}</p>}
        </form>
      </div>

      <aside className="summary-card">
        <span className="eyebrow">Resumen</span>
        <h3>{selectedService?.name || "Selecciona servicio"}</h3>
        <div className="summary-list">
          <p><UserRound size={16} /> {selectedBarber?.name || "Barbero"}</p>
          <p><CalendarDays size={16} /> {form.date || "Fecha"} {selectedSlot ? `/ ${selectedSlot.label}` : ""}</p>
          <p><Clock3 size={16} /> {duration || 0} min</p>
        </div>
        <div className="price-breakdown">
          <span>{selectedService?.name || "Servicio"} <b>{money(selectedService?.price || 0)}</b></span>
          {selectedAddons.map((addon) => (
            <span key={addon.id}>{addon.name} <b>{money(addon.price)}</b></span>
          ))}
          {!selectedAddons.length && <span>Sin extras <b>{money(0)}</b></span>}
        </div>
        <div className="total-line">
          <span>Total</span>
          <strong>{money(total)}</strong>
        </div>
        <small>Si alguien toma una hora, desaparece del calendario para todos.</small>
      </aside>
    </section>
  );
}
