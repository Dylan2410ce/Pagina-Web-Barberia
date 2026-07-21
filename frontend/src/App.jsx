import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi, borrarToken, guardarToken, obtenerToken, publicoApi } from "./api/client";
import AdminPanel from "./components/AdminPanel";
import BookingWizard from "./components/BookingWizard";
import ClientAppointments from "./components/ClientAppointments";
import Hero from "./components/Hero";
import MapModal from "./components/MapModal";
import Navbar from "./components/Navbar";
import ServiceMenu from "./components/ServiceMenu";
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
  servicios: [],
  horarios: [],
  clientes: [],
  stats: null,
  tab: "agenda",
  filtros: { date: hoyISO(), status: "", q: "" },
};

export default function App() {
  const [ruta, setRuta] = useState(() => window.location.pathname);
  const [datos, setDatos] = useState({ barbers: [], services: [], addons: [], location: {} });
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

  const resumen = useMemo(() => ({
    servicio: servicioActivo,
    extras: extrasActivos,
    total: (servicioActivo?.price || 0) + extrasActivos.reduce((sum, item) => sum + item.price, 0),
    duracion: (servicioActivo?.duration_min || 0) + extrasActivos.reduce((sum, item) => sum + item.duration_min, 0),
    hora: slots.find((slot) => slot.start_min === reserva.start_min)?.label || "",
  }), [servicioActivo, extrasActivos, reserva.start_min, slots]);

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
        servicios: valor(2, actual.servicios || []),
        horarios: valor(3, actual.horarios || []),
        clientes: valor(4, actual.clientes || []),
        stats: valor(5, actual.stats || {}),
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
        const barbers = (bootstrap.barbers || []).filter((barbero) => barbero.name.toLowerCase().includes("sebastian"));
        const normalizados = { ...bootstrap, barbers, services: bootstrap.services || [], addons: bootstrap.addons || [] };
        setDatos(normalizados);
        const primeraReserva = {
          ...reservaInicial,
          barber_id: barbers[0]?.id || "",
          service_id: normalizados.services[0]?.id || "",
        };
        setReserva(primeraReserva);
        setCargando(false);
        await cargarSlots(primeraReserva);
        const tokenGuardado = obtenerToken();
        if (tokenGuardado) await cargarAdmin(tokenGuardado, adminBase.filtros);
      } catch (error) {
        setCargando(false);
        avisar("error", "La agenda no cargo", error.message);
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
  });

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
    if (!servicioActivo) return avisar("warning", "Escoge un servicio");
    if (reserva.start_min === null) return avisar("warning", "Escoge una hora");
    if (!validarTelefono(telefono)) return avisar("warning", "Revisa el telefono", "Usa 8 digitos de Costa Rica.");

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
    if (!validarTelefono(telefono)) return avisar("warning", "Telefono invalido");
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
    if (!telefonoBusqueda) return avisar("warning", "Busca primero por telefono");
    if (!confirm("Quieres cancelar esta cita?")) return;
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
    setModalReprogramar({ cita, modo, date: hoyISO(), start_min: null, slots: [], cargando: true });
    try {
      const servicio = datos.services.find((item) => item.name === cita.service_name) || datos.services[0];
      const disponibles = await publicoApi.disponibilidad({
        barberId: reserva.barber_id,
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
        barberId: reserva.barber_id,
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

  const loginAdmin = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setProcesando("Entrando al panel...");
    try {
      const respuesta = await adminApi.login(data);
      guardarToken(respuesta.token);
      setAdmin((actual) => ({ ...actual, token: respuesta.token }));
      await cargarAdmin(respuesta.token, admin.filtros);
      avisar("ok", "Panel abierto");
    } catch (error) {
      avisar("error", "No se pudo entrar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setProcesando("Actualizando clave...");
    try {
      await adminApi.resetPassword(data);
      event.currentTarget.reset();
      avisar("ok", "Clave actualizada");
    } catch (error) {
      avisar("error", "No se pudo cambiar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const cerrarAdmin = () => {
    borrarToken();
    setAdmin(adminBase);
    avisar("ok", "Sesion cerrada");
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

  const crearBloqueo = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const allDay = data.all_day === "on";
    setProcesando("Bloqueando espacio...");
    try {
      await adminApi.crearBloqueo(admin.token, {
        date: data.date,
        all_day: allDay,
        start_min: allDay ? 480 : horaAMinutos(data.start_time),
        end_min: allDay ? null : horaAMinutos(data.end_time),
        notes: data.notes || null,
      });
      event.currentTarget.reset();
      await cargarAdmin();
      await cargarSlots();
      avisar("ok", "Espacio bloqueado");
    } catch (error) {
      avisar("error", "No se pudo bloquear", error.message);
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
                <button className="icon-btn" type="button" onClick={() => setModalReprogramar(null)}>×</button>
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
                  {!modalReprogramar.cargando && modalReprogramar.slots.length === 0 && <div className="slots-vacio">No hay horas libres ese dia.</div>}
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
          barbero={datos.barbers[0]}
          servicios={datos.services}
          primerSlot={slots[0]?.label}
          onMapa={() => setModalMapa(true)}
        />
        <ServiceMenu
          servicios={datos.services}
          extras={datos.addons}
          reserva={reserva}
          onServicio={seleccionarServicio}
          onExtra={toggleExtra}
        />
        <BookingWizard
          reserva={reserva}
          setReserva={setReserva}
          resumen={resumen}
          slots={slots}
          cargandoSlots={cargandoSlots}
          minFecha={hoyISO()}
          onFecha={cambiarFecha}
          onSubmit={crearCita}
        />
        <ClientAppointments
          telefono={telefonoBusqueda}
          setTelefono={setTelefonoBusqueda}
          citas={citasCliente}
          onBuscar={buscarCitas}
          onCancelar={cancelarCliente}
          onReprogramar={(cita) => abrirReprogramar(cita, "cliente")}
        />
        <section id="ubicacion" className="seccion ubicacion">
          <div className="panel reveal">
            <span className="eyebrow">Llegada facil</span>
            <h2>Te esperamos en Barrio Maranonal.</h2>
            <p>{datos.location.address}</p>
            <div className="hero-acciones">
              <button className="btn btn-secundario" type="button" onClick={() => setModalMapa(true)}>Ver mapa</button>
              <a className="btn btn-principal" href={datos.location.wazeUrl} target="_blank" rel="noreferrer">Abrir Waze</a>
            </div>
          </div>
        </section>
      </main>
      <footer className="footer">
        <div>
          <strong>Sebas Barber</strong>
          <span>Agenda simple, cortes precisos y trato relajado.</span>
        </div>
        <small>Pagina web creada y desarrollada por Dylan Calvo Escobar, 2026. Todos los derechos reservados.</small>
      </footer>
      <button className="cta-flotante" type="button" onClick={() => document.querySelector("#reserva")?.scrollIntoView({ behavior: "smooth" })}>
        Agendar
      </button>
      {modalMapa && <MapModal location={datos.location} onClose={() => setModalMapa(false)} />}
      {modalReprogramar && (
        <div className="modal-backdrop">
          <section className="modal">
            <header>
              <strong>Elige una nueva hora</strong>
              <button className="icon-btn" type="button" onClick={() => setModalReprogramar(null)}>×</button>
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
                {!modalReprogramar.cargando && modalReprogramar.slots.length === 0 && <div className="slots-vacio">No hay horas libres ese dia.</div>}
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
