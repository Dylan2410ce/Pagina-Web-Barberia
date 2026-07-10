import {
  claseEstado,
  diasSemana,
  dinero,
  escaparHtml,
  fechaCorta,
  fechaHumana,
  hoyISO,
  minutosAHora,
  textoEstado,
} from "../utils/format.js";

export function panelAdmin(estado) {
  if (!estado.admin.token) {
    return loginAdmin(estado);
  }

  return `
    <section id="admin" class="seccion bloque admin-shell">
      <div class="cabecera-seccion reveal">
        <span class="eyebrow">Panel privado</span>
        <h2>Control completo de Sebas Barber.</h2>
        <p>Agenda, servicios, horarios, bloqueos, clientes y reportes.</p>
      </div>
      <div class="admin-toolbar panel reveal">
        <div>
          <strong>${escaparHtml(estado.admin.perfil?.name || "Sebastian")}</strong>
          <span>${escaparHtml(estado.admin.perfil?.role || "Admin")}</span>
        </div>
        <nav class="tabs">
          ${["agenda", "servicios", "horarios", "clientes", "reportes"].map((tab) => `
            <button class="${estado.admin.tab === tab ? "activo" : ""}" data-action="admin-tab" data-tab="${tab}">
              ${tab}
            </button>
          `).join("")}
        </nav>
        <button class="btn btn-linea" data-action="admin-salir">Salir</button>
      </div>
      ${dashboard(estado)}
      ${contenidoTab(estado)}
    </section>
  `;
}

function loginAdmin(estado) {
  return `
    <section id="admin" class="seccion bloque">
      <div class="admin-login panel reveal">
        <div>
          <span class="eyebrow">Admin</span>
          <h2>Entrar al panel</h2>
          <p>Acceso privado para Sebastian. Si olvidás la clave, usá el código maestro.</p>
        </div>
        <form id="form-admin-login" class="formulario">
          <div class="campo">
            <label>Usuario</label>
            <input name="username" value="sebas" autocomplete="username" required />
          </div>
          <div class="campo">
            <label>Contraseña</label>
            <input name="password" type="password" autocomplete="current-password" required />
          </div>
          <button class="btn btn-principal btn-ancho" type="submit">Entrar</button>
        </form>
        <details class="reset-box">
          <summary>Recuperar contraseña</summary>
          <form id="form-reset-password" class="formulario">
            <input name="username" value="sebas" required />
            <input name="master_code" placeholder="Código maestro" required />
            <input name="new_password" type="password" minlength="8" placeholder="Nueva contraseña" required />
            <button class="btn btn-secundario" type="submit">Cambiar contraseña</button>
          </form>
        </details>
      </div>
    </section>
  `;
}

function dashboard(estado) {
  const data = estado.admin.dashboard || {};
  return `
    <div class="admin-metricas reveal">
      <article><span>Hoy</span><strong>${data.appointments_today || 0}</strong><small>Citas activas</small></article>
      <article><span>Completadas</span><strong>${data.completed_today || 0}</strong><small>Asistencias</small></article>
      <article><span>Ingresos hoy</span><strong>${dinero(data.income_today || 0)}</strong><small>Real generado</small></article>
      <article><span>Proyectado</span><strong>${dinero(data.projected_today || 0)}</strong><small>Reservas + completas</small></article>
    </div>
  `;
}

function contenidoTab(estado) {
  const tab = estado.admin.tab;
  if (tab === "servicios") return serviciosAdmin(estado);
  if (tab === "horarios") return horariosAdmin(estado);
  if (tab === "clientes") return clientesAdmin(estado);
  if (tab === "reportes") return reportesAdmin(estado);
  return agendaAdmin(estado);
}

function agendaAdmin(estado) {
  const citas = estado.admin.citas || [];
  const lista = citas.length
    ? citas.map(citaAdmin).join("")
    : `<div class="vacio">No hay citas para estos filtros.</div>`;

  return `
    <div class="panel reveal">
      <div class="panel-head">
        <div>
          <h3>Agenda</h3>
          <p>Filtrá, marcá asistencia, cancelá o mové espacios.</p>
        </div>
      </div>
      <form id="form-admin-filtros" class="filtros-admin">
        <input name="date" type="date" value="${estado.admin.filtros.date || hoyISO()}" />
        <select name="status">
          ${["", "booked", "present", "noshow", "cancelled", "blocked"].map((estadoCita) => `
            <option value="${estadoCita}" ${estado.admin.filtros.status === estadoCita ? "selected" : ""}>
              ${estadoCita ? textoEstado(estadoCita) : "Todos"}
            </option>
          `).join("")}
        </select>
        <input name="q" placeholder="Buscar cliente, teléfono o servicio" value="${escaparHtml(estado.admin.filtros.q || "")}" />
        <button class="btn btn-principal" type="submit">Filtrar</button>
      </form>
      <div class="tabla-citas">${lista}</div>
    </div>
    <div class="panel reveal">
      <div class="panel-head">
        <div>
          <h3>Bloquear horario</h3>
          <p>Para descansos, feriados, diligencias o citas hechas fuera de la web.</p>
        </div>
      </div>
      <form id="form-bloqueo" class="form-grid">
        <input name="date" type="date" min="${hoyISO()}" value="${hoyISO()}" required />
        <label class="check-line"><input name="all_day" type="checkbox" /> Todo el día</label>
        <input name="start_time" type="time" value="08:00" />
        <input name="end_time" type="time" value="09:00" />
        <input name="notes" placeholder="Motivo del bloqueo" />
        <button class="btn btn-secundario" type="submit">Crear bloqueo</button>
      </form>
    </div>
  `;
}

function citaAdmin(cita) {
  return `
    <article class="fila-cita">
      <div>
        <span class="${claseEstado(cita.status)}">${textoEstado(cita.status)}</span>
        <h4>${escaparHtml(cita.client_name)}</h4>
        <p>${escaparHtml(cita.client_phone)} · ${escaparHtml(cita.service_name)}</p>
      </div>
      <div>
        <strong>${fechaHumana(cita.starts_at)}</strong>
        <span>${dinero(cita.total_price)}</span>
      </div>
      <div class="acciones-card">
        <button class="btn btn-linea" data-action="admin-estado" data-id="${cita.id}" data-status="present">Asistió</button>
        <button class="btn btn-linea" data-action="admin-estado" data-id="${cita.id}" data-status="noshow">No asistió</button>
        <button class="btn btn-linea" data-action="admin-mover" data-id="${cita.id}">Mover</button>
        <button class="btn btn-peligro" data-action="admin-estado" data-id="${cita.id}" data-status="cancelled">Cancelar</button>
      </div>
    </article>
  `;
}

function serviciosAdmin(estado) {
  const cards = (estado.admin.servicios || []).map((servicio) => `
    <form class="servicio-edit" data-service-form="${servicio.id}">
      <input name="name" value="${escaparHtml(servicio.name)}" required />
      <input name="duration_min" type="number" min="0" max="360" value="${servicio.duration_min}" />
      <input name="price" type="number" min="0" value="${servicio.price}" />
      <label class="check-line"><input name="is_addon" type="checkbox" ${servicio.is_addon ? "checked" : ""} /> Extra</label>
      <label class="check-line"><input name="is_active" type="checkbox" ${servicio.is_active ? "checked" : ""} /> Activo</label>
      <button class="btn btn-secundario" type="submit">Guardar</button>
    </form>
  `).join("");

  return `
    <div class="panel reveal">
      <div class="panel-head">
        <div>
          <h3>Servicios y precios</h3>
          <p>Editá duración, precio y disponibilidad del menú.</p>
        </div>
      </div>
      <form id="form-servicio-nuevo" class="form-grid servicio-nuevo">
        <input name="name" placeholder="Nuevo servicio" required />
        <input name="duration_min" type="number" min="0" max="360" value="45" />
        <input name="price" type="number" min="0" value="6000" />
        <label class="check-line"><input name="is_addon" type="checkbox" /> Extra</label>
        <button class="btn btn-principal" type="submit">Crear</button>
      </form>
      <div class="servicios-admin-grid">${cards}</div>
    </div>
  `;
}

function horariosAdmin(estado) {
  const filas = (estado.admin.horarios || []).map((hora) => `
    <form class="horario-row" data-hour-form="${hora.weekday}">
      <strong>${diasSemana[hora.weekday]}</strong>
      <label class="check-line"><input name="is_open" type="checkbox" ${hora.is_open ? "checked" : ""} /> Abierto</label>
      <input name="open_time" type="time" value="${minutosAHora(hora.open_min)}" />
      <input name="close_time" type="time" value="${minutosAHora(hora.close_min)}" />
      <button class="btn btn-secundario" type="submit">Guardar</button>
    </form>
  `).join("");

  return `
    <div class="panel reveal">
      <div class="panel-head">
        <div>
          <h3>Horario comercial</h3>
          <p>Estos horarios alimentan el selector público de citas.</p>
        </div>
      </div>
      <div class="horarios-lista">${filas}</div>
    </div>
  `;
}

function clientesAdmin(estado) {
  const clientes = estado.admin.clientes || [];
  const lista = clientes.length
    ? clientes.map((cliente) => `
      <article class="cliente-card">
        <div>
          <h4>${escaparHtml(cliente.name)}</h4>
          <p>${escaparHtml(cliente.phone)} ${cliente.email ? `· ${escaparHtml(cliente.email)}` : ""}</p>
          <small>Última visita: ${cliente.last_visit ? fechaCorta(cliente.last_visit) : "Sin visitas"}</small>
        </div>
        <div>
          <strong>${cliente.appointments}</strong>
          <span>citas</span>
        </div>
        <div>
          <strong>${dinero(cliente.spent)}</strong>
          <span>generado</span>
        </div>
      </article>
    `).join("")
    : `<div class="vacio">Aún no hay clientes registrados.</div>`;

  return `
    <div class="panel reveal">
      <div class="panel-head">
        <div>
          <h3>Clientes</h3>
          <p>Historial simple por teléfono.</p>
        </div>
      </div>
      <div class="clientes-lista">${lista}</div>
    </div>
  `;
}

function reportesAdmin(estado) {
  const stats = estado.admin.stats || {};
  const servicios = stats.service_breakdown || [];
  const diarios = stats.daily_income || [];
  return `
    <div class="panel reveal">
      <div class="panel-head">
        <div>
          <h3>Reportes del mes</h3>
          <p>Ingresos, asistencia, cancelación y servicios más fuertes.</p>
        </div>
      </div>
      <div class="admin-metricas compactas">
        <article><span>Generado</span><strong>${dinero(stats.income || 0)}</strong><small>Solo completadas</small></article>
        <article><span>Proyectado</span><strong>${dinero(stats.projected_income || 0)}</strong><small>Reservadas + completadas</small></article>
        <article><span>Ticket promedio</span><strong>${dinero(stats.average_ticket || 0)}</strong><small>Por asistencia</small></article>
        <article><span>Asistencia</span><strong>${stats.attendance_rate || 0}%</strong><small>Vs no asistió</small></article>
      </div>
      <div class="reportes-grid">
        <div>
          <h4>Servicios populares</h4>
          ${servicios.map((item) => `<p><strong>${escaparHtml(item.name)}</strong><span>${item.count} · ${dinero(item.income)}</span></p>`).join("") || "<p>Sin datos.</p>"}
        </div>
        <div>
          <h4>Ingresos por día</h4>
          ${diarios.map((item) => `<p><strong>Día ${item.day}</strong><span>${item.count} citas · ${dinero(item.income)}</span></p>`).join("") || "<p>Sin datos.</p>"}
        </div>
      </div>
    </div>
  `;
}
