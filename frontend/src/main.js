import "./styles.css";
import { adminApi, borrarToken, guardarToken, obtenerToken, publicoApi } from "./api/client.js";
import { abrirModal, cerrarModal } from "./components/modal.js";
import { mostrarCarga, ocultarCarga, toast } from "./components/toast.js";
import { panelAdmin } from "./pages/admin.js";
import { paginaPublica } from "./pages/public.js";
import {
  hoyISO,
  horaAMinutos,
  limpiarTelefono,
  mesActual,
  minutosAHora,
  validarTelefono,
} from "./utils/format.js";

const root = document.querySelector("#root");

const estado = {
  cargandoInicial: true,
  menuAbierto: false,
  navSolida: false,
  datos: { barbers: [], services: [], addons: [], location: {} },
  slots: [],
  cargandoSlots: false,
  telefonoBusqueda: "",
  citasCliente: [],
  reserva: {
    barber_id: "",
    service_id: "",
    addon_ids: [],
    date: hoyISO(),
    start_min: null,
    client_name: "",
    client_phone: "",
    client_email: "",
    notes: "",
  },
  admin: {
    token: obtenerToken(),
    perfil: null,
    dashboard: null,
    citas: [],
    servicios: [],
    horarios: [],
    clientes: [],
    stats: null,
    tab: "agenda",
    filtros: { date: hoyISO(), status: "", q: "" },
  },
};

let observer;

async function iniciar() {
  escucharEventos();
  render();
  try {
    const datos = await publicoApi.iniciar();
    estado.datos = {
      ...datos,
      barbers: (datos.barbers || []).filter((barbero) => barbero.name.toLowerCase().includes("sebastian")),
      services: datos.services || [],
      addons: datos.addons || [],
    };
    estado.reserva.barber_id = estado.datos.barbers[0]?.id || "";
    estado.reserva.service_id = estado.datos.services[0]?.id || "";
    estado.cargandoInicial = false;
    await cargarSlots();
    if (estado.admin.token) await cargarAdmin();
  } catch (error) {
    estado.cargandoInicial = false;
    toast("error", "No se pudo conectar con la API", error.message);
    render();
  }
}

function render() {
  root.innerHTML = `<div class="app">${paginaPublica(estado)}${panelAdmin(estado)}</div>`;
  activarReveals();
}

function activarReveals() {
  observer?.disconnect();
  observer = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (entrada.isIntersecting) entrada.target.classList.add("visible");
      });
    },
    { threshold: 0.14 },
  );
  document.querySelectorAll(".reveal").forEach((nodo) => observer.observe(nodo));
}

function escucharEventos() {
  document.addEventListener("click", manejarClick);
  document.addEventListener("submit", manejarSubmit);
  document.addEventListener("change", manejarChange);
  document.addEventListener("input", manejarInput);
  window.addEventListener("scroll", () => {
    const solida = window.scrollY > 20;
    if (estado.navSolida !== solida) {
      estado.navSolida = solida;
      document.querySelector(".navbar")?.classList.toggle("navbar-solida", solida);
    }
  });
}

async function manejarClick(evento) {
  const scrollTarget = evento.target.closest("[data-scroll]");
  if (scrollTarget) {
    evento.preventDefault();
    document.querySelector(scrollTarget.dataset.scroll)?.scrollIntoView({ behavior: "smooth", block: "start" });
    estado.menuAbierto = false;
    render();
    return;
  }

  const accion = evento.target.closest("[data-action]");
  if (!accion) return;
  const action = accion.dataset.action;

  if (action === "menu") {
    estado.menuAbierto = !estado.menuAbierto;
    render();
    return;
  }

  if (action === "seleccionar-servicio") {
    estado.reserva.service_id = accion.dataset.id;
    estado.reserva.start_min = null;
    await cargarSlots();
    document.querySelector("#reserva")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (action === "toggle-extra") {
    const id = accion.dataset.id;
    estado.reserva.addon_ids = estado.reserva.addon_ids.includes(id)
      ? estado.reserva.addon_ids.filter((item) => item !== id)
      : [...estado.reserva.addon_ids, id];
    estado.reserva.start_min = null;
    await cargarSlots();
    return;
  }

  if (action === "seleccionar-hora") {
    estado.reserva.start_min = Number(accion.dataset.min);
    render();
    return;
  }

  if (action === "abrir-mapa") {
    abrirMapa();
    return;
  }

  if (action === "cliente-cancelar") {
    await cancelarCliente(accion.dataset.id);
    return;
  }

  if (action === "cliente-reprogramar") {
    abrirReprogramar(accion.dataset.id, "cliente");
    return;
  }

  if (action === "admin-tab") {
    estado.admin.tab = accion.dataset.tab;
    await cargarAdmin();
    render();
    return;
  }

  if (action === "admin-salir") {
    borrarToken();
    estado.admin.token = "";
    toast("ok", "Sesión cerrada");
    render();
    return;
  }

  if (action === "admin-estado") {
    await cambiarEstadoAdmin(accion.dataset.id, accion.dataset.status);
    return;
  }

  if (action === "admin-mover") {
    abrirReprogramar(accion.dataset.id, "admin");
    return;
  }

  if (action === "modal-slot") {
    document.querySelectorAll(".modal-slot").forEach((slot) => slot.classList.remove("activo"));
    accion.classList.add("activo");
    const input = document.querySelector("#modal-start-min");
    if (input) input.value = accion.dataset.min;
    const submit = document.querySelector("#form-reprogramar button[type='submit']");
    if (submit) submit.disabled = false;
  }
}

async function manejarSubmit(evento) {
  const form = evento.target;
  if (!(form instanceof HTMLFormElement)) return;

  if (form.id === "form-reserva") {
    evento.preventDefault();
    await crearCita(form);
  }

  if (form.id === "form-buscar-cita") {
    evento.preventDefault();
    await buscarCitasCliente(form);
  }

  if (form.id === "form-admin-login") {
    evento.preventDefault();
    await loginAdmin(form);
  }

  if (form.id === "form-reset-password") {
    evento.preventDefault();
    await resetPassword(form);
  }

  if (form.id === "form-admin-filtros") {
    evento.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    estado.admin.filtros = data;
    await cargarAdmin();
    render();
  }

  if (form.id === "form-bloqueo") {
    evento.preventDefault();
    await crearBloqueo(form);
  }

  if (form.id === "form-servicio-nuevo") {
    evento.preventDefault();
    await crearServicio(form);
  }

  if (form.dataset.serviceForm) {
    evento.preventDefault();
    await editarServicio(form);
  }

  if (form.dataset.hourForm) {
    evento.preventDefault();
    await editarHorario(form);
  }

  if (form.id === "form-reprogramar") {
    evento.preventDefault();
    await enviarReprogramacion(form);
  }
}

async function manejarChange(evento) {
  if (evento.target.id === "fecha-reserva") {
    estado.reserva.date = evento.target.value || hoyISO();
    estado.reserva.start_min = null;
    await cargarSlots();
  }

  if (evento.target.id === "modal-fecha") {
    const form = evento.target.closest("form");
    const id = form?.dataset.id;
    const modo = form?.dataset.mode;
    if (id && modo) await cargarSlotsModal(id, modo, evento.target.value);
  }
}

function manejarInput(evento) {
  const target = evento.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.id === "cliente-telefono") {
    target.value = limpiarTelefono(target.value);
  }
  if (target.name && target.closest("#form-reserva")) {
    estado.reserva[target.name] = target.name === "client_phone" ? limpiarTelefono(target.value) : target.value;
  }
  if (target.name === "phone" && target.closest("#form-buscar-cita")) {
    target.value = limpiarTelefono(target.value);
    estado.telefonoBusqueda = target.value;
  }
}

async function cargarSlots() {
  if (!estado.reserva.barber_id || !estado.reserva.service_id || !estado.reserva.date) {
    estado.slots = [];
    render();
    return;
  }

  estado.cargandoSlots = true;
  render();
  try {
    estado.slots = await publicoApi.disponibilidad({
      barberId: estado.reserva.barber_id,
      fecha: estado.reserva.date,
      serviceId: estado.reserva.service_id,
      addonIds: estado.reserva.addon_ids,
    });
  } catch (error) {
    estado.slots = [];
    toast("error", "No se pudo leer disponibilidad", error.message);
  } finally {
    estado.cargandoSlots = false;
    render();
  }
}

async function crearCita(form) {
  const data = Object.fromEntries(new FormData(form));
  const telefono = limpiarTelefono(data.client_phone);
  if (!estado.reserva.service_id) return toast("warning", "Elegí un servicio");
  if (estado.reserva.start_min === null) return toast("warning", "Elegí una hora disponible");
  if (!validarTelefono(telefono)) return toast("warning", "Teléfono inválido", "Usá 8 dígitos de Costa Rica.");

  mostrarCarga("Confirmando cita...");
  try {
    await publicoApi.crearCita({
      barber_id: estado.reserva.barber_id,
      service_id: estado.reserva.service_id,
      addon_ids: estado.reserva.addon_ids,
      date: estado.reserva.date,
      start_min: estado.reserva.start_min,
      client_name: data.client_name.trim(),
      client_phone: telefono,
      client_email: data.client_email?.trim() || null,
      notes: data.notes?.trim() || null,
    });
    toast("ok", "Cita confirmada", "El horario quedó reservado.");
    estado.reserva.start_min = null;
    estado.reserva.client_name = "";
    estado.reserva.client_phone = "";
    estado.reserva.client_email = "";
    estado.reserva.notes = "";
    await cargarSlots();
  } catch (error) {
    toast("error", "No se pudo reservar", error.message);
  } finally {
    ocultarCarga();
  }
}

async function buscarCitasCliente(form) {
  const telefono = limpiarTelefono(new FormData(form).get("phone"));
  if (!validarTelefono(telefono)) return toast("warning", "Teléfono inválido");
  mostrarCarga("Buscando citas...");
  try {
    estado.telefonoBusqueda = telefono;
    estado.citasCliente = await publicoApi.buscarPorTelefono(telefono);
    toast("ok", estado.citasCliente.length ? "Citas encontradas" : "Sin citas activas");
    render();
  } catch (error) {
    toast("error", "No se pudo buscar", error.message);
  } finally {
    ocultarCarga();
  }
}

async function cancelarCliente(id) {
  if (!estado.telefonoBusqueda) return toast("warning", "Primero buscá por teléfono");
  if (!confirm("¿Cancelar esta cita y liberar el horario?")) return;
  mostrarCarga("Cancelando cita...");
  try {
    await publicoApi.cancelarCita(id, { phone: estado.telefonoBusqueda, reason: "Cancelada desde la web" });
    estado.citasCliente = await publicoApi.buscarPorTelefono(estado.telefonoBusqueda);
    await cargarSlots();
    toast("ok", "Cita cancelada", "El espacio quedó libre.");
  } catch (error) {
    toast("error", "No se pudo cancelar", error.message);
  } finally {
    ocultarCarga();
    render();
  }
}

async function loginAdmin(form) {
  mostrarCarga("Entrando al panel...");
  try {
    const token = await adminApi.login(Object.fromEntries(new FormData(form)));
    estado.admin.token = token.token;
    guardarToken(token.token);
    await cargarAdmin();
    toast("ok", "Bienvenido al panel");
    render();
  } catch (error) {
    toast("error", "Login incorrecto", error.message);
  } finally {
    ocultarCarga();
  }
}

async function resetPassword(form) {
  mostrarCarga("Actualizando contraseña...");
  try {
    await adminApi.resetPassword(Object.fromEntries(new FormData(form)));
    toast("ok", "Contraseña actualizada", "Ya podés entrar con la nueva clave.");
    form.reset();
  } catch (error) {
    toast("error", "No se pudo cambiar", error.message);
  } finally {
    ocultarCarga();
  }
}

async function cargarAdmin() {
  if (!estado.admin.token) return;
  const token = estado.admin.token;
  const { year, month } = mesActual();
  const filtros = limpiarFiltros(estado.admin.filtros);
  try {
    const [perfil, dashboard, citas, servicios, horarios, clientes, stats] = await Promise.all([
      adminApi.perfil(token),
      adminApi.dashboard(token),
      adminApi.citas(token, filtros),
      adminApi.servicios(token),
      adminApi.horarios(token),
      adminApi.clientes(token),
      adminApi.stats(token, year, month),
    ]);
    estado.admin.perfil = perfil;
    estado.admin.dashboard = dashboard;
    estado.admin.citas = citas;
    estado.admin.servicios = servicios;
    estado.admin.horarios = horarios;
    estado.admin.clientes = clientes;
    estado.admin.stats = stats;
  } catch (error) {
    borrarToken();
    estado.admin.token = "";
    toast("error", "Sesión expirada", error.message);
  }
}

function limpiarFiltros(filtros) {
  return Object.fromEntries(Object.entries(filtros).filter(([, valor]) => valor !== ""));
}

async function cambiarEstadoAdmin(id, status) {
  mostrarCarga("Actualizando cita...");
  try {
    await adminApi.estadoCita(estado.admin.token, id, status);
    await cargarAdmin();
    await cargarSlots();
    toast("ok", "Cita actualizada", `Estado: ${status}`);
  } catch (error) {
    toast("error", "No se pudo actualizar", error.message);
  } finally {
    ocultarCarga();
    render();
  }
}

async function crearBloqueo(form) {
  const data = Object.fromEntries(new FormData(form));
  const allDay = data.all_day === "on";
  mostrarCarga("Creando bloqueo...");
  try {
    await adminApi.crearBloqueo(estado.admin.token, {
      date: data.date,
      start_min: allDay ? 480 : horaAMinutos(data.start_time),
      end_min: allDay ? null : horaAMinutos(data.end_time),
      all_day: allDay,
      notes: data.notes || null,
    });
    await cargarAdmin();
    await cargarSlots();
    toast("ok", "Horario bloqueado", "Ya no aparecerá disponible.");
  } catch (error) {
    toast("error", "No se pudo bloquear", error.message);
  } finally {
    ocultarCarga();
    render();
  }
}

async function crearServicio(form) {
  const data = Object.fromEntries(new FormData(form));
  mostrarCarga("Creando servicio...");
  try {
    await adminApi.crearServicio(estado.admin.token, {
      name: data.name.trim(),
      duration_min: Number(data.duration_min || 0),
      price: Number(data.price || 0),
      is_addon: data.is_addon === "on",
      is_active: true,
    });
    await refrescarServicios();
    toast("ok", "Servicio creado");
  } catch (error) {
    toast("error", "No se pudo crear", error.message);
  } finally {
    ocultarCarga();
    render();
  }
}

async function editarServicio(form) {
  const data = Object.fromEntries(new FormData(form));
  mostrarCarga("Guardando servicio...");
  try {
    await adminApi.editarServicio(estado.admin.token, form.dataset.serviceForm, {
      name: data.name.trim(),
      duration_min: Number(data.duration_min || 0),
      price: Number(data.price || 0),
      is_addon: data.is_addon === "on",
      is_active: data.is_active === "on",
    });
    await refrescarServicios();
    toast("ok", "Servicio actualizado");
  } catch (error) {
    toast("error", "No se pudo guardar", error.message);
  } finally {
    ocultarCarga();
    render();
  }
}

async function refrescarServicios() {
  const datos = await publicoApi.iniciar();
  estado.datos.services = datos.services || [];
  estado.datos.addons = datos.addons || [];
  estado.admin.servicios = await adminApi.servicios(estado.admin.token);
  if (!estado.datos.services.some((item) => item.id === estado.reserva.service_id)) {
    estado.reserva.service_id = estado.datos.services[0]?.id || "";
  }
  await cargarSlots();
}

async function editarHorario(form) {
  const weekday = Number(form.dataset.hourForm);
  const data = Object.fromEntries(new FormData(form));
  mostrarCarga("Guardando horario...");
  try {
    await adminApi.editarHorario(estado.admin.token, weekday, {
      weekday,
      is_open: data.is_open === "on",
      open_min: horaAMinutos(data.open_time),
      close_min: horaAMinutos(data.close_time),
    });
    await cargarAdmin();
    await cargarSlots();
    toast("ok", "Horario actualizado");
  } catch (error) {
    toast("error", "No se pudo guardar", error.message);
  } finally {
    ocultarCarga();
    render();
  }
}

function abrirMapa() {
  const loc = estado.datos.location;
  abrirModal({
    titulo: "Ubicación de Sebas Barber",
    contenido: `
      <iframe class="mapa-frame" loading="lazy"
        src="https://maps.google.com/maps?q=${loc.lat},${loc.lng}&z=16&output=embed"></iframe>
      <div class="modal-actions">
        <a class="btn btn-secundario" target="_blank" rel="noreferrer" href="${loc.googleMapsUrl}">Google Maps</a>
        <a class="btn btn-principal" target="_blank" rel="noreferrer" href="${loc.wazeUrl}">Waze</a>
      </div>
    `,
  });
}

function buscarCita(id, modo) {
  const lista = modo === "cliente" ? estado.citasCliente : estado.admin.citas;
  return lista.find((item) => item.id === id);
}

function abrirReprogramar(id, modo) {
  const cita = buscarCita(id, modo);
  if (!cita) return toast("warning", "Cita no encontrada");
  abrirModal({
    titulo: "Reprogramar cita",
    contenido: `
      <form id="form-reprogramar" data-id="${id}" data-mode="${modo}" class="formulario">
        <div class="campo">
          <label>Nueva fecha</label>
          <input id="modal-fecha" name="date" type="date" min="${hoyISO()}" value="${hoyISO()}" required />
        </div>
        <input id="modal-start-min" name="start_min" type="hidden" />
        <div class="campo">
          <label>Horas libres</label>
          <div class="slots modal-slots"><span class="spinner"></span></div>
        </div>
        <button class="btn btn-principal btn-ancho" type="submit" disabled>Guardar cambio</button>
      </form>
    `,
    alMontar: () => cargarSlotsModal(id, modo, hoyISO()),
  });
}

async function cargarSlotsModal(id, modo, fecha) {
  const cita = buscarCita(id, modo);
  const contenedor = document.querySelector(".modal-slots");
  if (!cita || !contenedor) return;
  const servicio = estado.datos.services.find((item) => item.name === cita.service_name) || estado.datos.services[0];
  contenedor.innerHTML = `<span class="spinner"></span>`;
  try {
    const slots = await publicoApi.disponibilidad({
      barberId: estado.reserva.barber_id,
      fecha,
      serviceId: servicio?.id,
      addonIds: [],
    });
    contenedor.innerHTML = slots.length
      ? slots.map((slot) => `<button type="button" class="slot modal-slot" data-action="modal-slot" data-min="${slot.start_min}">${slot.label}</button>`).join("")
      : `<div class="slots-vacio">Sin horas libres para esa fecha.</div>`;
  } catch (error) {
    contenedor.innerHTML = `<div class="slots-vacio">${error.message}</div>`;
  }
}

async function enviarReprogramacion(form) {
  const id = form.dataset.id;
  const modo = form.dataset.mode;
  const data = Object.fromEntries(new FormData(form));
  if (!data.start_min) return toast("warning", "Elegí una hora");

  mostrarCarga("Reprogramando cita...");
  try {
    if (modo === "cliente") {
      await publicoApi.reprogramarCita(id, {
        phone: estado.telefonoBusqueda,
        date: data.date,
        start_min: Number(data.start_min),
      });
      estado.citasCliente = await publicoApi.buscarPorTelefono(estado.telefonoBusqueda);
    } else {
      await adminApi.moverCita(estado.admin.token, id, {
        date: data.date,
        start_min: Number(data.start_min),
      });
      await cargarAdmin();
    }
    await cargarSlots();
    cerrarModal();
    toast("ok", "Cita reprogramada", `Nueva hora: ${minutosAHora(data.start_min)}`);
  } catch (error) {
    toast("error", "No se pudo reprogramar", error.message);
  } finally {
    ocultarCarga();
    render();
  }
}

iniciar();
