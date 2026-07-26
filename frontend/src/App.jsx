import { useCallback, useEffect, useMemo, useState } from "react";
import { Code2 } from "lucide-react";
import { adminApi, borrarToken, guardarToken, obtenerToken, publicoApi } from "./api/client";
import AdminPanel from "./components/AdminPanel";
import BookingSuccessModal from "./components/BookingSuccessModal";
import BookingWizard from "./components/BookingWizard";
import ClientAppointments from "./components/ClientAppointments";
import Gallery from "./components/Gallery";
import Hero from "./components/Hero";
import LocationSection from "./components/LocationSection";
import MapModal from "./components/MapModal";
import Navbar from "./components/Navbar";
import ServiceMenu from "./components/ServiceMenu";
import ScrollToTop from "./components/ScrollToTop";
import TeamSection from "./components/TeamSection";
import Toasts from "./components/Toasts";
import { enviarCorreosCita } from "./services/emailjsService";
import { hoyISO, horaAMinutos, limpiarTelefono, mesActual, validarTelefono } from "./utils/format";

const reservaInicial = {
  barber_id: "",
  service_id: "",
  addon_ids: [],
  date: hoyISO(),
  start_min: null,
  client_name: "",
  client_phone: "",
  client_email: "",
  notes: "",
};

const adminBase = {
  token: "",
  perfil: null,
  dashboard: null,
  citas: [],
  bloqueos: [],
  servicios: [],
  horarios: [],
  clientes: [],
  stats: null,
  tab: "resumen",
  filtros: { date: hoyISO(), status: "", q: "" },
};

export default function App() {
  const [ruta, setRuta] = useState(() => window.location.pathname);
  const [datos, setDatos] = useState({
    barbers: [],
    services: [],
    addons: [],
    business_hours: [],
    location: {},
  });
  const [reserva, setReserva] = useState(reservaInicial);
  const [slots, setSlots] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [procesando, setProcesando] = useState("");
  const [toastList, setToastList] = useState([]);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [navSolida, setNavSolida] = useState(false);
  const [modalMapa, setModalMapa] = useState(false);
  const [telefonoBusqueda, setTelefonoBusqueda] = useState("");
  const [citasCliente, setCitasCliente] = useState([]);
  const [admin, setAdmin] = useState(() => ({ ...adminBase, token: obtenerToken() }));
  const [modalReprogramar, setModalReprogramar] = useState(null);
  const [citaConfirmada, setCitaConfirmada] = useState(null);

  const avisar = useCallback((tipo, titulo, mensaje = "") => {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    setToastList((items) => [...items, { id, tipo, titulo, mensaje }]);
    setTimeout(() => setToastList((items) => items.filter((item) => item.id !== id)), tipo === "error" ? 6500 : 4200);
  }, []);

  const cerrarToast = (id) => setToastList((items) => items.filter((item) => item.id !== id));

  const servicioActivo = useMemo(
    () => datos.services.find((servicio) => servicio.id === reserva.service_id),
    [datos.services, reserva.service_id],
  );

  const extrasActivos = useMemo(
    () => datos.addons.filter((extra) => reserva.addon_ids.includes(extra.id)),
    [datos.addons, reserva.addon_ids],
  );

  const barberoActivo = useMemo(
    () => datos.barbers.find((barbero) => barbero.id === reserva.barber_id),
    [datos.barbers, reserva.barber_id],
  );

  const horariosActivos = useMemo(() => {
    const barberId = barberoActivo?.id || datos.barbers[0]?.id;
    return datos.business_hours.filter((item) => item.barber_id === barberId);
  }, [barberoActivo, datos.barbers, datos.business_hours]);

  const resumen = useMemo(() => ({
    barbero: barberoActivo,
    servicio: servicioActivo,
    extras: extrasActivos,
    total: (servicioActivo?.price || 0) + extrasActivos.reduce((sum, item) => sum + item.price, 0),
    duracion: (servicioActivo?.duration_min || 0) + extrasActivos.reduce((sum, item) => sum + item.duration_min, 0),
    hora: slots.find((slot) => slot.start_min === reserva.start_min)?.label || "",
  }), [barberoActivo, servicioActivo, extrasActivos, reserva.start_min, slots]);

  const cargarSlots = useCallback(async (override = {}) => {
    const siguiente = { ...reserva, ...override };
    if (!siguiente.barber_id || !siguiente.service_id || !siguiente.date) {
      setSlots([]);
      return;
    }
    setCargandoSlots(true);
    try {
      const respuesta = await publicoApi.disponibilidad({
        barberId: siguiente.barber_id,
        fecha: siguiente.date,
        serviceId: siguiente.service_id,
        addonIds: siguiente.addon_ids,
      });
      setSlots(respuesta);
    } catch (error) {
      setSlots([]);
      avisar("error", "No pudimos leer la agenda", error.message);
    } finally {
      setCargandoSlots(false);
    }
  }, [avisar, reserva]);

  const cargarAdmin = useCallback(async (tokenActual = admin.token, filtrosActuales = admin.filtros) => {
    if (!tokenActual) return;
    const { year, month } = mesActual();
    const limpiar = Object.fromEntries(Object.entries(filtrosActuales).filter(([, valor]) => valor !== ""));
    try {
      const perfil = await adminApi.perfil(tokenActual);
      const resultados = await Promise.allSettled([
        adminApi.dashboard(tokenActual),
        adminApi.citas(tokenActual, limpiar),
        adminApi.bloqueos(tokenActual),
        adminApi.servicios(tokenActual),
        adminApi.horarios(tokenActual),
        adminApi.clientes(tokenActual),
        adminApi.stats(tokenActual, year, month),
      ]);

      const valor = (index, fallback) => resultados[index].status === "fulfilled" ? resultados[index].value : fallback;
      const cargaParcial = resultados.some((resultado) => resultado.status === "rejected");

      setAdmin((actual) => ({
        ...actual,
        token: tokenActual,
        perfil,
        dashboard: valor(0, actual.dashboard || {}),
        citas: valor(1, actual.citas || []),
        bloqueos: valor(2, actual.bloqueos || []),
        servicios: valor(3, actual.servicios || []),
        horarios: valor(4, actual.horarios || []),
        clientes: valor(5, actual.clientes || []),
        stats: valor(6, actual.stats || {}),
      }));

      if (cargaParcial) {
        avisar("warning", "Panel cargado", "Algunos datos tardaron, pero la agenda sigue disponible.");
      }
    } catch (error) {
      borrarToken();
      setAdmin(adminBase);
      avisar("error", "Sesión vencida", error.message);
    }
  }, [admin.filtros, admin.token, avisar]);

  useEffect(() => {
    async function iniciar() {
      try {
        const bootstrap = await publicoApi.iniciar();
        const barbers = bootstrap.barbers || [];
        const normalizados = {
          ...bootstrap,
          barbers,
          services: bootstrap.services || [],
          addons: bootstrap.addons || [],
          business_hours: bootstrap.business_hours || [],
        };
        setDatos(normalizados);
        const primeraReserva = {
          ...reservaInicial,
          service_id: normalizados.services[0]?.id || "",
        };
        setReserva(primeraReserva);
        setCargando(false);
        const tokenGuardado = obtenerToken();
        if (tokenGuardado) await cargarAdmin(tokenGuardado, adminBase.filtros);
      } catch (error) {
        setCargando(false);
        avisar("error", "La agenda no cargó", error.message);
      }
    }
    iniciar();
  }, []);

  useEffect(() => {
    const onScroll = () => setNavSolida(window.scrollY > 18);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onPopState = () => setRuta(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("visible")),
      { threshold: 0.14 },
    );
    document.querySelectorAll(".reveal").forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [admin.tab, cargando, ruta]);

  const seleccionarBarbero = async (id, desplazar = false) => {
    const siguiente = { barber_id: id, start_min: null };
    setReserva((actual) => ({ ...actual, ...siguiente }));
    await cargarSlots(siguiente);
    if (desplazar) {
      document.querySelector("#reserva")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const seleccionarServicio = async (id) => {
    const siguiente = { service_id: id, start_min: null };
    setReserva((actual) => ({ ...actual, ...siguiente }));
    await cargarSlots(siguiente);
    document.querySelector("#reserva")?.scrollIntoView({ behavior: "smooth" });
  };

  const toggleExtra = async (id) => {
    const addon_ids = reserva.addon_ids.includes(id)
      ? reserva.addon_ids.filter((item) => item !== id)
      : [...reserva.addon_ids, id];
    setReserva((actual) => ({ ...actual, addon_ids, start_min: null }));
    await cargarSlots({ addon_ids, start_min: null });
  };

  const cambiarFecha = async (date) => {
    setReserva((actual) => ({ ...actual, date, start_min: null }));
    await cargarSlots({ date, start_min: null });
  };

  const crearCita = async (event) => {
    event.preventDefault();
    const telefono = limpiarTelefono(reserva.client_phone);
    if (!barberoActivo) return avisar("warning", "Escoge un barbero");
    if (!servicioActivo) return avisar("warning", "Escoge un servicio");
    if (reserva.start_min === null) return avisar("warning", "Escoge una hora");
    if (!validarTelefono(telefono)) return avisar("warning", "Revisa el teléfono", "Usa 8 dígitos de Costa Rica.");

    setProcesando("Reservando tu espacio...");
    try {
      const citaCreada = await publicoApi.crearCita({
        ...reserva,
        client_phone: telefono,
        client_email: reserva.client_email.trim() || null,
        notes: reserva.notes.trim() || null,
      });
      enviarCorreosCita(citaCreada, resumen).then((resultado) => {
        if (resultado.fallos) {
          avisar("warning", "Cita guardada", "La reserva quedo lista, pero algun correo no salio.");
        }
      });
      setCitaConfirmada(citaCreada);
      avisar("ok", "Cita lista", "Tu cita quedo reservada.");
      const limpia = { ...reserva, start_min: null, client_name: "", client_phone: "", client_email: "", notes: "" };
      setReserva(limpia);
      await cargarSlots(limpia);
    } catch (error) {
      avisar("error", "No se pudo reservar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const buscarCitas = async (event) => {
    event.preventDefault();
    const telefono = limpiarTelefono(telefonoBusqueda);
    if (!validarTelefono(telefono)) return avisar("warning", "Teléfono inválido");
    setProcesando("Buscando tus citas...");
    try {
      const citas = await publicoApi.buscarPorTelefono(telefono);
      setTelefonoBusqueda(telefono);
      setCitasCliente(citas);
      avisar("ok", citas.length ? "Encontramos tus citas" : "No hay citas activas");
    } catch (error) {
      avisar("error", "No se pudo buscar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const cancelarCliente = async (id) => {
    if (!telefonoBusqueda) return avisar("warning", "Busca primero por teléfono");
    if (!confirm("¿Quieres cancelar esta cita?")) return;
    setProcesando("Liberando el espacio...");
    try {
      await publicoApi.cancelarCita(id, { phone: telefonoBusqueda, reason: "Cancelada desde la web" });
      setCitasCliente(await publicoApi.buscarPorTelefono(telefonoBusqueda));
      await cargarSlots();
      avisar("ok", "Cita cancelada");
    } catch (error) {
      avisar("error", "No se pudo cancelar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const abrirReprogramar = async (cita, modo) => {
    const barberId = modo === "admin" ? admin.perfil?.id : cita.barber_id;
    if (!barberId) {
      avisar("error", "No identificamos la agenda de esta cita");
      return;
    }
    setModalReprogramar({
      cita,
      modo,
      barber_id: barberId,
      date: hoyISO(),
      start_min: null,
      slots: [],
      cargando: true,
    });
    try {
      const servicio = datos.services.find((item) => item.name === cita.service_name) || datos.services[0];
      const disponibles = await publicoApi.disponibilidad({
        barberId,
        fecha: hoyISO(),
        serviceId: servicio?.id,
        addonIds: [],
      });
      setModalReprogramar((actual) => actual ? { ...actual, slots: disponibles, cargando: false } : actual);
    } catch (error) {
      avisar("error", "No pudimos leer horas libres", error.message);
      setModalReprogramar((actual) => actual ? { ...actual, cargando: false } : actual);
    }
  };

  const cambiarFechaModal = async (date) => {
    if (!modalReprogramar) return;
    setModalReprogramar((actual) => ({ ...actual, date, start_min: null, cargando: true }));
    try {
      const servicio = datos.services.find((item) => item.name === modalReprogramar.cita.service_name) || datos.services[0];
      const disponibles = await publicoApi.disponibilidad({
        barberId: modalReprogramar.barber_id,
        fecha: date,
        serviceId: servicio?.id,
        addonIds: [],
      });
      setModalReprogramar((actual) => actual ? { ...actual, slots: disponibles, cargando: false } : actual);
    } catch (error) {
      avisar("error", "No pudimos leer horas libres", error.message);
      setModalReprogramar((actual) => actual ? { ...actual, slots: [], cargando: false } : actual);
    }
  };

  const confirmarReprogramacion = async () => {
    if (!modalReprogramar?.start_min) return avisar("warning", "Escoge una hora");
    setProcesando("Moviendo la cita...");
    try {
      if (modalReprogramar.modo === "cliente") {
        await publicoApi.reprogramarCita(modalReprogramar.cita.id, {
          phone: telefonoBusqueda,
          date: modalReprogramar.date,
          start_min: modalReprogramar.start_min,
        });
        setCitasCliente(await publicoApi.buscarPorTelefono(telefonoBusqueda));
      } else {
        await adminApi.moverCita(admin.token, modalReprogramar.cita.id, {
          date: modalReprogramar.date,
          start_min: modalReprogramar.start_min,
        });
        await cargarAdmin();
      }
      setModalReprogramar(null);
      await cargarSlots();
      avisar("ok", "Cita reprogramada");
    } catch (error) {
      avisar("error", "No se pudo reprogramar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const loginAdmin = async (data) => {
    setProcesando("Entrando al panel...");
    try {
      const respuesta = await adminApi.login(data);
      guardarToken(respuesta.token);
      setAdmin((actual) => ({ ...actual, token: respuesta.token }));
      await cargarAdmin(respuesta.token, admin.filtros);
      avisar("ok", "Panel abierto");
      return true;
    } catch (error) {
      avisar("error", "No se pudo entrar", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const resetPassword = async (data) => {
    setProcesando("Actualizando clave...");
    try {
      await adminApi.resetPassword(data);
      avisar("ok", "Clave actualizada", "Ya puedes entrar con tu nueva contraseña.");
      return true;
    } catch (error) {
      avisar("error", "No se pudo cambiar", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const cambiarPassword = async (data) => {
    setProcesando("Actualizando clave...");
    try {
      await adminApi.changePassword(admin.token, data);
      borrarToken();
      setAdmin({ ...adminBase });
      avisar("ok", "Clave actualizada", "Inicia sesión de nuevo para continuar.");
      return true;
    } catch (error) {
      avisar("error", "No se pudo cambiar", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const cerrarAdmin = () => {
    borrarToken();
    setAdmin(adminBase);
    avisar("ok", "Sesión cerrada");
  };

  const cambiarTabAdmin = async (tab) => {
    setAdmin((actual) => ({ ...actual, tab }));
    await cargarAdmin();
  };

  const filtrarAdmin = async (event) => {
    event.preventDefault();
    const filtros = Object.fromEntries(new FormData(event.currentTarget));
    setAdmin((actual) => ({ ...actual, filtros }));
    await cargarAdmin(admin.token, filtros);
  };

  const cambiarEstadoAdmin = async (id, status) => {
    setProcesando("Actualizando agenda...");
    try {
      await adminApi.estadoCita(admin.token, id, status);
      await cargarAdmin();
      await cargarSlots();
      avisar("ok", "Agenda actualizada");
    } catch (error) {
      avisar("error", "No se pudo actualizar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const crearBloqueo = async (data) => {
    setProcesando("Bloqueando espacio...");
    try {
      await adminApi.crearBloqueo(admin.token, data);
      await cargarAdmin();
      await cargarSlots();
      avisar("ok", "Espacio bloqueado");
      return true;
    } catch (error) {
      avisar("error", "No se pudo bloquear", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const guardarServicio = async (event, id = null) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const payload = {
      name: data.name.trim(),
      duration_min: Number(data.duration_min || 0),
      price: Number(data.price || 0),
      is_addon: data.is_addon === "on",
      is_active: id ? data.is_active === "on" : true,
    };
    setProcesando(id ? "Guardando servicio..." : "Creando servicio...");
    try {
      if (id) await adminApi.editarServicio(admin.token, id, payload);
      else await adminApi.crearServicio(admin.token, payload);
      const bootstrap = await publicoApi.iniciar();
      setDatos((actual) => ({ ...actual, services: bootstrap.services || [], addons: bootstrap.addons || [] }));
      await cargarAdmin();
      avisar("ok", id ? "Servicio actualizado" : "Servicio creado");
    } catch (error) {
      avisar("error", "No se pudo guardar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const guardarHorario = async (event, weekday) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setProcesando("Guardando horario...");
    try {
      await adminApi.editarHorario(admin.token, weekday, {
        weekday,
        is_open: data.is_open === "on",
        open_min: horaAMinutos(data.open_time),
        close_min: horaAMinutos(data.close_time),
      });
      await cargarAdmin();
      await cargarSlots();
      avisar("ok", "Horario guardado");
    } catch (error) {
      avisar("error", "No se pudo guardar", error.message);
    } finally {
      setProcesando("");
    }
  };

  if (cargando) {
    return (
      <main className="pantalla-carga">
        <span className="spinner grande" />
        <p>Abriendo la agenda de Sebas Barber...</p>
      </main>
    );
  }

  const adminProps = {
    admin,
    onLogin: loginAdmin,
    onResetPassword: resetPassword,
    onSalir: cerrarAdmin,
    onTab: cambiarTabAdmin,
    onFiltrar: filtrarAdmin,
    onEstado: cambiarEstadoAdmin,
    onMover: (cita) => abrirReprogramar(cita, "admin"),
    onBloqueo: crearBloqueo,
    onGuardarServicio: guardarServicio,
    onGuardarHorario: guardarHorario,
    onChangePassword: cambiarPassword,
  };

  if (ruta.startsWith("/admin")) {
    return (
      <>
        <main className="admin-route">
          <AdminPanel {...adminProps} standalone />
        </main>
        {procesando && (
          <div className="loader-global">
            <div>
              <span className="spinner grande" />
              <p>{procesando}</p>
            </div>
          </div>
        )}
        {modalReprogramar && (
          <div className="modal-backdrop">
            <section className="modal">
              <header>
                <strong>Elige una nueva hora</strong>
                <button className="icon-btn" type="button" onClick={() => setModalReprogramar(null)} aria-label="Cerrar">X</button>
              </header>
              <div className="modal-body formulario">
                <div className="campo">
                  <label>Nueva fecha</label>
                  <input type="date" min={hoyISO()} value={modalReprogramar.date} onChange={(event) => cambiarFechaModal(event.target.value)} />
                </div>
                <div className="slots">
                  {modalReprogramar.cargando && <div className="slots-vacio"><span className="spinner" /> Buscando horas...</div>}
                  {!modalReprogramar.cargando && modalReprogramar.slots.map((slot) => (
                    <button
                      key={slot.start_min}
                      className={`slot ${modalReprogramar.start_min === slot.start_min ? "activo" : ""}`}
                      type="button"
                      onClick={() => setModalReprogramar((actual) => ({ ...actual, start_min: slot.start_min }))}
                    >
                      {slot.label}
                    </button>
                  ))}
                  {!modalReprogramar.cargando && modalReprogramar.slots.length === 0 && <div className="slots-vacio">No hay horas libres ese día.</div>}
                </div>
                <button className="btn btn-principal btn-ancho" type="button" onClick={confirmarReprogramacion}>
                  Guardar cambio
                </button>
              </div>
            </section>
          </div>
        )}
        <Toasts items={toastList} onClose={cerrarToast} />
      </>
    );
  }

  return (
    <>
      <Navbar abierto={menuAbierto} solida={navSolida} onToggle={() => setMenuAbierto((value) => !value)} />
      <main>
        <Hero
          barberos={datos.barbers}
          barbero={barberoActivo}
          primerSlot={slots[0]?.label}
          onMapa={() => setModalMapa(true)}
        />
        <TeamSection
          barberos={datos.barbers}
          seleccionado={reserva.barber_id}
          onSeleccionar={seleccionarBarbero}
        />
        <ServiceMenu
          servicios={datos.services}
          extras={datos.addons}
          reserva={reserva}
          onServicio={seleccionarServicio}
          onExtra={toggleExtra}
        />
        <Gallery />
        <BookingWizard
          reserva={reserva}
          setReserva={setReserva}
          resumen={resumen}
          servicios={datos.services}
          extras={datos.addons}
          barberos={datos.barbers}
          barbero={barberoActivo}
          slots={slots}
          cargandoSlots={cargandoSlots}
          minFecha={hoyISO()}
          onFecha={cambiarFecha}
          onBarbero={seleccionarBarbero}
          onServicio={seleccionarServicio}
          onExtra={toggleExtra}
          onSubmit={crearCita}
        />
        <ClientAppointments
          telefono={telefonoBusqueda}
          setTelefono={setTelefonoBusqueda}
          citas={citasCliente}
          barberos={datos.barbers}
          onBuscar={buscarCitas}
          onCancelar={cancelarCliente}
          onReprogramar={(cita) => abrirReprogramar(cita, "cliente")}
        />
        <LocationSection
          location={datos.location}
          horarios={horariosActivos}
          barbero={barberoActivo || datos.barbers[0]}
          onMapa={() => setModalMapa(true)}
        />
      </main>
      <footer className="footer">
        <div className="footer-main">
          <div className="footer-brand">
            <strong>Sebas Barber</strong>
            <span>Cortes precisos. Agenda clara. Buen servicio.</span>
          </div>
          <nav aria-label="Enlaces del pie de página">
            <a href="#equipo">Barberos</a>
            <a href="#servicios">Servicios</a>
            <a href="#reserva">Reservar</a>
            <a href="#ubicacion">Ubicación</a>
          </nav>
        </div>
        <div className="footer-legal">
          <small>© {new Date().getFullYear()} Sebas Barber. Todos los derechos reservados.</small>
          <small className="footer-credit">
            <Code2 size={14} />
            Desarrollado por <span>Dylan Calvo Escobar</span> | Innovación y tecnología.
          </small>
        </div>
      </footer>
      <ScrollToTop />
      {modalMapa && <MapModal location={datos.location} onClose={() => setModalMapa(false)} />}
      {citaConfirmada && (
        <BookingSuccessModal
          cita={citaConfirmada}
          barbero={datos.barbers.find((item) => item.id === citaConfirmada.barber_id)}
          onClose={() => setCitaConfirmada(null)}
        />
      )}
      {modalReprogramar && (
        <div className="modal-backdrop">
          <section className="modal">
            <header>
              <strong>Elige una nueva hora</strong>
              <button className="icon-btn" type="button" onClick={() => setModalReprogramar(null)} aria-label="Cerrar">X</button>
            </header>
            <div className="modal-body formulario">
              <div className="campo">
                <label>Nueva fecha</label>
                <input type="date" min={hoyISO()} value={modalReprogramar.date} onChange={(event) => cambiarFechaModal(event.target.value)} />
              </div>
              <div className="slots">
                {modalReprogramar.cargando && <div className="slots-vacio"><span className="spinner" /> Buscando horas...</div>}
                {!modalReprogramar.cargando && modalReprogramar.slots.map((slot) => (
                  <button
                    key={slot.start_min}
                    className={`slot ${modalReprogramar.start_min === slot.start_min ? "activo" : ""}`}
                    type="button"
                    onClick={() => setModalReprogramar((actual) => ({ ...actual, start_min: slot.start_min }))}
                  >
                    {slot.label}
                  </button>
                ))}
                {!modalReprogramar.cargando && modalReprogramar.slots.length === 0 && <div className="slots-vacio">No hay horas libres ese día.</div>}
              </div>
              <button className="btn btn-principal btn-ancho" type="button" onClick={confirmarReprogramacion}>
                Guardar cambio
              </button>
            </div>
          </section>
        </div>
      )}
      {procesando && (
        <div className="loader-global">
          <div>
            <span className="spinner grande" />
            <p>{procesando}</p>
          </div>
        </div>
      )}
      <Toasts items={toastList} onClose={cerrarToast} />
    </>
  );
}
