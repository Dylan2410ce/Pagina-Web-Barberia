import {
  claseEstado,
  dinero,
  escaparHtml,
  fechaHumana,
  hoyISO,
  textoEstado,
} from "../utils/format.js";

export function paginaPublica(estado) {
  if (estado.cargandoInicial) {
    return `
      <main class="pantalla-carga">
        <div class="spinner grande"></div>
        <p>Cargando agenda de Sebas Barber...</p>
      </main>
    `;
  }

  const barbero = estado.datos.barbers?.[0];
  return `
    ${navbar(estado)}
    <main>
      ${hero(estado, barbero)}
      ${servicios(estado)}
      ${reserva(estado, barbero)}
      ${gestionCliente(estado)}
      ${ubicacion(estado)}
      <footer class="footer">
        <strong>Sebas Barber</strong>
        <span>C. 19, Espíritu Santo, Barrio Marañonal</span>
      </footer>
    </main>
    <button class="cta-flotante" data-scroll="#reserva">Agendar</button>
  `;
}

function navbar(estado) {
  return `
    <header class="navbar ${estado.navSolida ? "navbar-solida" : ""}">
      <nav class="nav-contenido">
        <a class="marca" href="#inicio" aria-label="Sebas Barber">
          <span>SB</span>
          <strong>Sebas Barber</strong>
        </a>
        <button class="hamburguesa" data-action="menu" aria-label="Abrir menú">
          <i></i><i></i><i></i>
        </button>
        <div class="nav-links ${estado.menuAbierto ? "abierto" : ""}">
          <a href="#servicios">Menú</a>
          <a href="#reserva">Reservar</a>
          <a href="#mis-citas">Mis citas</a>
          <a href="#admin">Admin</a>
        </div>
      </nav>
    </header>
  `;
}

function hero(estado, barbero) {
  const totalServicios = estado.datos.services?.length || 0;
  const primerSlot = estado.slots?.[0]?.label || "Revisá disponibilidad";
  return `
    <section id="inicio" class="hero seccion">
      <div class="hero-copy reveal">
        <span class="eyebrow">Exclusivo con Sebastian</span>
        <h1>Cortes limpios, agenda clara y cero vueltas.</h1>
        <p>
          Reservá en segundos, elegí el servicio exacto y mirá solo horas libres.
          La agenda se valida en servidor y Google Calendar para evitar choques.
        </p>
        <div class="hero-acciones">
          <button class="btn btn-principal" data-scroll="#reserva">Agendar cita</button>
          <button class="btn btn-secundario" data-scroll="#servicios">Ver menú</button>
        </div>
      </div>
      <aside class="hero-panel reveal">
        <div class="tarjeta-destacada">
          <span class="chip">Sebastian</span>
          <h2>${escaparHtml(barbero?.role || "Master Barber")}</h2>
          <p>Agenda personalizada, servicios medidos por duración y buffer de 5 minutos entre citas.</p>
        </div>
        <div class="metricas">
          <article><strong>${totalServicios}</strong><span>Servicios activos</span></article>
          <article><strong>${primerSlot}</strong><span>Próximo espacio</span></article>
          <article><strong>Google</strong><span>Disponibilidad real</span></article>
        </div>
      </aside>
    </section>
  `;
}

function servicios(estado) {
  const servicioId = estado.reserva.service_id;
  const addonIds = estado.reserva.addon_ids;
  const serviciosHtml = estado.datos.services
    .map((servicio) => tarjetaServicio(servicio, servicio.id === servicioId, false))
    .join("");
  const extrasHtml = estado.datos.addons
    .map((extra) => tarjetaServicio(extra, addonIds.includes(extra.id), true))
    .join("");

  return `
    <section id="servicios" class="seccion bloque">
      <div class="cabecera-seccion reveal">
        <span class="eyebrow">Menú de barbería</span>
        <h2>Precios claros, servicios fáciles de escoger.</h2>
        <p>Todos los precios ya incluyen el aumento automático de ₡1000 sobre la tarifa base.</p>
      </div>
      <div class="menu-layout reveal">
        <div>
          <h3>Cortes principales</h3>
          <div class="menu-grid">${serviciosHtml}</div>
        </div>
        <aside class="extras-panel">
          <h3>Extras rápidos</h3>
          <div class="extras-grid">${extrasHtml || "<p>No hay extras activos.</p>"}</div>
        </aside>
      </div>
    </section>
  `;
}

function tarjetaServicio(servicio, activo, esExtra) {
  const accion = esExtra ? "toggle-extra" : "seleccionar-servicio";
  return `
    <article class="servicio-card ${activo ? "activo" : ""}">
      <div>
        <span>${esExtra ? "Extra" : "Servicio"}</span>
        <h4>${escaparHtml(servicio.name)}</h4>
        <p>${servicio.duration_min || 0} min</p>
      </div>
      <strong>${dinero(servicio.price)}</strong>
      <button class="btn ${activo ? "btn-principal" : "btn-linea"}" data-action="${accion}" data-id="${servicio.id}">
        ${activo ? "Elegido" : "Elegir"}
      </button>
    </article>
  `;
}

function reserva(estado, barbero) {
  const resumen = resumenReserva(estado);
  const slots = estado.cargandoSlots
    ? `<div class="slots-vacio"><span class="spinner"></span> Consultando Calendar...</div>`
    : estado.slots.length
      ? estado.slots
          .map(
            (slot) => `
              <button class="slot ${estado.reserva.start_min === slot.start_min ? "activo" : ""}"
                data-action="seleccionar-hora"
                data-min="${slot.start_min}">
                ${slot.label}
              </button>
            `,
          )
          .join("")
      : `<div class="slots-vacio">No hay horas libres para esa fecha.</div>`;

  return `
    <section id="reserva" class="seccion reserva-grid">
      <div class="panel reveal">
        <div class="wizard-head">
          <span class="eyebrow">Reserva</span>
          <h2>Agendá sin llamadas.</h2>
          <p>Elegí servicio, fecha, hora y confirmá tus datos.</p>
        </div>

        <div class="pasos">
          <span class="${estado.reserva.service_id ? "ok" : "activo"}">1 Servicio</span>
          <span class="${estado.reserva.start_min !== null ? "ok" : ""}">2 Hora</span>
          <span>3 Datos</span>
        </div>

        <div class="campo">
          <label for="fecha-reserva">Fecha</label>
          <input id="fecha-reserva" type="date" min="${hoyISO()}" value="${estado.reserva.date}" />
        </div>

        <div class="campo">
          <label>Horas disponibles</label>
          <div class="slots">${slots}</div>
        </div>

        <form id="form-reserva" class="formulario">
          <div class="campo">
            <label for="cliente-nombre">Nombre completo</label>
            <input id="cliente-nombre" name="client_name" autocomplete="name" minlength="3" maxlength="80" required
              placeholder="Ej: Dylan Vargas" value="${escaparHtml(estado.reserva.client_name)}" />
          </div>
          <div class="form-doble">
            <div class="campo">
              <label for="cliente-telefono">WhatsApp</label>
              <input id="cliente-telefono" name="client_phone" inputmode="numeric" maxlength="8" required
                placeholder="88887777" value="${escaparHtml(estado.reserva.client_phone)}" />
            </div>
            <div class="campo">
              <label for="cliente-email">Correo opcional</label>
              <input id="cliente-email" name="client_email" type="email" maxlength="160"
                placeholder="correo@ejemplo.com" value="${escaparHtml(estado.reserva.client_email)}" />
            </div>
          </div>
          <div class="campo">
            <label for="cliente-notas">Notas opcionales</label>
            <input id="cliente-notas" name="notes" maxlength="240" placeholder="Detalle extra para Sebastian"
              value="${escaparHtml(estado.reserva.notes)}" />
          </div>
          <button class="btn btn-principal btn-ancho" type="submit" ${!resumen.listo ? "disabled" : ""}>
            Confirmar cita
          </button>
        </form>
      </div>

      <aside class="panel resumen-card reveal">
        <span class="chip">Resumen</span>
        <h3>${resumen.servicio}</h3>
        <ul>
          <li><span>Barbero</span><strong>${escaparHtml(barbero?.name || "Sebastian")}</strong></li>
          <li><span>Fecha</span><strong>${estado.reserva.date || "Pendiente"}</strong></li>
          <li><span>Hora</span><strong>${resumen.hora}</strong></li>
          <li><span>Duración</span><strong>${resumen.duracion} min</strong></li>
          <li><span>Total</span><strong>${dinero(resumen.total)}</strong></li>
        </ul>
        <p class="nota">Si otra persona toma el mismo espacio antes, el servidor lo bloquea automáticamente.</p>
      </aside>
    </section>
  `;
}

function gestionCliente(estado) {
  const citas = estado.citasCliente || [];
  const lista = citas.length
    ? citas
        .map(
          (cita) => {
            const acciones = cita.status === "booked"
              ? `
                <div class="acciones-card">
                  <button class="btn btn-linea" data-action="cliente-reprogramar" data-id="${cita.id}">Reprogramar</button>
                  <button class="btn btn-peligro" data-action="cliente-cancelar" data-id="${cita.id}">Cancelar</button>
                </div>
              `
              : `<span class="nota">Sin acciones disponibles</span>`;
            return `
            <article class="cita-card">
              <div>
                <span class="${claseEstado(cita.status)}">${textoEstado(cita.status)}</span>
                <h4>${escaparHtml(cita.service_name)}</h4>
                <p>${fechaHumana(cita.starts_at)} · ${dinero(cita.total_price)}</p>
              </div>
              ${acciones}
            </article>
          `;
          },
        )
        .join("")
    : `<div class="vacio">Buscá por teléfono para ver citas activas.</div>`;

  return `
    <section id="mis-citas" class="seccion bloque">
      <div class="cabecera-seccion reveal">
        <span class="eyebrow">Mis citas</span>
        <h2>Cancelar o reprogramar sin escribirle a nadie.</h2>
        <p>Ingresá el mismo teléfono que usaste al reservar.</p>
      </div>
      <div class="panel reveal">
        <form id="form-buscar-cita" class="busqueda-linea">
          <input name="phone" inputmode="numeric" maxlength="8" placeholder="Teléfono de 8 dígitos"
            value="${escaparHtml(estado.telefonoBusqueda)}" required />
          <button class="btn btn-principal" type="submit">Buscar</button>
        </form>
        <div class="lista-citas">${lista}</div>
      </div>
    </section>
  `;
}

function ubicacion(estado) {
  const loc = estado.datos.location;
  return `
    <section id="ubicacion" class="seccion ubicacion">
      <div class="panel reveal">
        <span class="eyebrow">Ubicación</span>
        <h2>Espíritu Santo, Barrio Marañonal.</h2>
        <p>${escaparHtml(loc.address)}</p>
        <div class="hero-acciones">
          <button class="btn btn-secundario" data-action="abrir-mapa">Ver mapa</button>
          <a class="btn btn-principal" href="${loc.wazeUrl}" target="_blank" rel="noreferrer">Abrir Waze</a>
        </div>
      </div>
    </section>
  `;
}

export function resumenReserva(estado) {
  const servicio = estado.datos.services.find((item) => item.id === estado.reserva.service_id);
  const extras = estado.datos.addons.filter((item) => estado.reserva.addon_ids.includes(item.id));
  const slot = estado.slots.find((item) => item.start_min === estado.reserva.start_min);
  const total = (servicio?.price || 0) + extras.reduce((sum, item) => sum + item.price, 0);
  const duracion = (servicio?.duration_min || 0) + extras.reduce((sum, item) => sum + item.duration_min, 0);
  return {
    servicio: servicio ? servicio.name : "Elegí un servicio",
    hora: slot?.label || "Pendiente",
    total,
    duracion,
    listo: Boolean(servicio && estado.reserva.date && estado.reserva.start_min !== null),
  };
}
