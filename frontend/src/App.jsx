import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Code2 } from "lucide-react";
import { adminApi, borrarToken, guardarToken, obtenerToken, publicoApi } from "./api/client";
import BookingSuccessModal from "./components/BookingSuccessModal";
import BookingWizard from "./components/BookingWizard";
import ClientAppointments from "./components/ClientAppointments";
import ConfirmDialog from "./components/ConfirmDialog";
import FaqSection from "./components/FaqSection";
import FloatingContact from "./components/FloatingContact";
import Gallery from "./components/Gallery";
import Hero from "./components/Hero";
import LocationSection from "./components/LocationSection";
import MapModal from "./components/MapModal";
import Navbar from "./components/Navbar";
import RescheduleModal from "./components/RescheduleModal";
import ReviewsSection from "./components/ReviewsSection";
import ServiceMenu from "./components/ServiceMenu";
import ScrollToTop from "./components/ScrollToTop";
import TeamSection from "./components/TeamSection";
import Toasts from "./components/Toasts";
import {
  enviarCorreosActualizacion,
  enviarCorreosCita,
} from "./services/emailjsService";
import {
  fechaHumana,
  hoyISO,
  horaAMinutos,
  limpiarTelefono,
  mesActual,
  validarTelefono,
} from "./utils/format";
import { normalizarBarberos } from "./utils/barbers";
import {
  guardarReservaLocal,
  leerReservasGuardadas,
  ultimaReservaGuardada,
} from "./utils/bookingStorage";
import { normalizarServicios } from "./utils/services";

const AdminPanel = lazy(() => import("./components/AdminPanel"));
const LegalPage = lazy(() => import("./components/LegalPage"));
const LEGAL_ROUTES = new Set([
  "/privacidad",
  "/terminos-reserva",
  "/aviso-cancelacion",
]);
const CONTACT_KEY = "sebas_booking_contact";

function nuevoRequestId() {
  return globalThis.crypto?.randomUUID?.()
    || `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function leerContactoRecordado() {
  try {
    return JSON.parse(localStorage.getItem(CONTACT_KEY) || "{}");
  } catch {
    return {};
  }
}

function codigoReservaDesdeUrl() {
  const searchCode = new URLSearchParams(window.location.search).get("reserva");
  const hashQuery = window.location.hash.split("?")[1] || "";
  return new URLSearchParams(hashQuery).get("reserva") || searchCode || "";
}

const reservaInicial = {
  request_id: "",
  barber_id: "",
  service_id: "",
  addon_ids: [],
  date: hoyISO(),
  start_min: null,
  client_name: "",
  client_phone: "",
  client_email: "",
  notes: "",
  website: "",
};

function nuevaReserva(recordarContacto = true) {
  const contact = recordarContacto ? leerContactoRecordado() : {};
  return {
    ...reservaInicial,
    request_id: nuevoRequestId(),
    client_name: contact.client_name || "",
    client_phone: contact.client_phone || "",
    client_email: contact.client_email || "",
  };
}

const adminBase = {
  token: "",
  perfil: null,
  dashboard: null,
  citas: [],
  bloqueos: [],
  servicios: [],
  horarios: [],
  ausencias: [],
  clientes: [],
  actividad: [],
  listaEspera: [],
  reseñas: [],
  galeria: [],
  operaciones: {
    settings: null,
    breaks: [],
    promotions: [],
    expenses: [],
    cash_closes: [],
    notifications: [],
    feedback: [],
    metrics: null,
  },
  stats: null,
  tab: "resumen",
  filtros: { date: hoyISO(), status: "", q: "" },
};

export default function App() {
  const [ruta, setRuta] = useState(() => window.location.pathname);
  const esRutaLegal = LEGAL_ROUTES.has(ruta);
  const [datos, setDatos] = useState({
    barbers: [],
    services: [],
    addons: [],
    business_hours: [],
    business_breaks: [],
    promotions: [],
    reviews: [],
    gallery: [],
    location: {},
  });
  const [reserva, setReserva] = useState(nuevaReserva);
  const [recordarContacto, setRecordarContacto] = useState(
    () => Boolean(localStorage.getItem(CONTACT_KEY)),
  );
  const [slots, setSlots] = useState([]);
  const [estadosLocal, setEstadosLocal] = useState({});
  const [cargando, setCargando] = useState(!esRutaLegal);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [procesando, setProcesando] = useState("");
  const [toastList, setToastList] = useState([]);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [navSolida, setNavSolida] = useState(false);
  const [modalMapa, setModalMapa] = useState(false);
  const [telefonoBusqueda, setTelefonoBusqueda] = useState("");
  const [codigoBusqueda, setCodigoBusqueda] = useState(() => (
    codigoReservaDesdeUrl()
    || ultimaReservaGuardada()?.access_code
    || ""
  ));
  const [citasCliente, setCitasCliente] = useState([]);
  const [fidelidad, setFidelidad] = useState(null);
  const [reservasGuardadas, setReservasGuardadas] = useState(
    leerReservasGuardadas,
  );
  const [pasoSolicitado, setPasoSolicitado] = useState(null);
  const [admin, setAdmin] = useState(() => ({ ...adminBase, token: obtenerToken() }));
  const [modalReprogramar, setModalReprogramar] = useState(null);
  const [citaConfirmada, setCitaConfirmada] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);

  const avisar = useCallback((tipo, titulo, mensaje = "") => {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    setToastList((items) => [...items, { id, tipo, titulo, mensaje }]);
    setTimeout(() => setToastList((items) => items.filter((item) => item.id !== id)), tipo === "error" ? 6500 : 4200);
  }, []);

  const cerrarToast = (id) => setToastList((items) => items.filter((item) => item.id !== id));

  const confirmarAccion = () => {
    const accion = confirmacion?.onConfirm;
    setConfirmacion(null);
    accion?.();
  };

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

  const resumenCorreo = useCallback((cita) => ({
    barbero: datos.barbers.find((item) => item.id === cita.barber_id),
    servicio: datos.services.find((item) => item.id === cita.service_id),
    extras: datos.addons.filter((item) => cita.addons?.includes(item.name)),
    duracion: datos.services.find((item) => item.id === cita.service_id)?.duration_min,
  }), [datos.addons, datos.barbers, datos.services]);

  const horariosActivos = useMemo(() => {
    const barberId = barberoActivo?.id || datos.barbers[0]?.id;
    return datos.business_hours.filter((item) => item.barber_id === barberId);
  }, [barberoActivo, datos.barbers, datos.business_hours]);

  const resumen = useMemo(() => {
    const subtotal = (servicioActivo?.price || 0)
      + extrasActivos.reduce((sum, item) => sum + item.price, 0);
    const promociones = (datos.promotions || []).filter((item) => (
      item.barber_id === barberoActivo?.id
      && (!item.service_id || item.service_id === servicioActivo?.id)
      && item.start_date <= reserva.date
      && item.end_date >= reserva.date
      && item.is_active
    ));
    const aplicada = promociones
      .map((item) => ({
        ...item,
        discount: item.discount_type === "percentage"
          ? Math.round(subtotal * item.discount_value / 100)
          : item.discount_value,
      }))
      .sort((a, b) => b.discount - a.discount)[0];
    const descuento = Math.min(
      Math.max(aplicada?.discount || 0, 0),
      Math.max(subtotal - 1, 0),
    );
    return {
      barbero: barberoActivo,
      servicio: servicioActivo,
      extras: extrasActivos,
      subtotal,
      descuento,
      promocion: aplicada?.name || "",
      total: subtotal - descuento,
      duracion: servicioActivo?.duration_min || 0,
      hora: slots.find((slot) => slot.start_min === reserva.start_min)?.label || "",
    };
  }, [
    barberoActivo,
    datos.promotions,
    extrasActivos,
    reserva.date,
    reserva.start_min,
    servicioActivo,
    slots,
  ]);

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
        adminApi.ausencias(tokenActual),
        adminApi.clientes(tokenActual),
        adminApi.stats(tokenActual, year, month),
        adminApi.actividad(tokenActual),
        adminApi.listaEspera(tokenActual),
        adminApi.reseñas(tokenActual),
        adminApi.galeria(tokenActual),
        adminApi.operaciones(tokenActual),
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
        ausencias: valor(5, actual.ausencias || []),
        clientes: valor(6, actual.clientes || []),
        stats: valor(7, actual.stats || {}),
        actividad: valor(8, actual.actividad || []),
        listaEspera: valor(9, actual.listaEspera || []),
        reseñas: valor(10, actual.reseñas || []),
        galeria: valor(11, actual.galeria || []),
        operaciones: valor(12, actual.operaciones || adminBase.operaciones),
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
    if (esRutaLegal) return undefined;

    async function iniciar() {
      try {
        const bootstrap = await publicoApi.iniciar();
        const barbers = normalizarBarberos(bootstrap.barbers || []);
        const normalizados = {
          ...bootstrap,
          barbers,
          services: normalizarServicios(bootstrap.services || []),
          addons: normalizarServicios(bootstrap.addons || []),
          business_hours: bootstrap.business_hours || [],
          business_breaks: bootstrap.business_breaks || [],
          promotions: bootstrap.promotions || [],
          reviews: bootstrap.reviews || [],
          gallery: bootstrap.gallery || [],
        };
        setDatos(normalizados);
        setReserva(nuevaReserva);
        setCargando(false);
        const codigoUrl = codigoReservaDesdeUrl();
        if (codigoUrl) {
          if (new URLSearchParams(window.location.search).has("reserva")) {
            window.history.replaceState(
              null,
              "",
              `/#mis-citas?reserva=${encodeURIComponent(codigoUrl)}`,
            );
          }
          try {
            const [cita, historial, progreso] = await Promise.all([
              publicoApi.buscarPorCodigo(codigoUrl),
              publicoApi.historialPorCodigo(codigoUrl),
              publicoApi.fidelidad(codigoUrl),
            ]);
            setCodigoBusqueda(codigoUrl);
            setCitasCliente(historial.map((item) => (
              item.id === cita?.id
                ? { ...item, _access_code: codigoUrl }
                : item
            )));
            setFidelidad(progreso);
            requestAnimationFrame(() => {
              document.getElementById("mis-citas")?.scrollIntoView({ block: "start" });
            });
          } catch {
            avisar("warning", "Código no encontrado", "Revisa el comprobante de tu reserva.");
          }
        }
        const tokenGuardado = obtenerToken();
        if (tokenGuardado) await cargarAdmin(tokenGuardado, adminBase.filtros);
      } catch (error) {
        setCargando(false);
        avisar("error", "La agenda no cargó", error.message);
      }
    }
    iniciar();
    return undefined;
  }, [esRutaLegal]);

  useEffect(() => {
    if (!datos.barbers.length || esRutaLegal) return undefined;
    let active = true;
    const cargarEstados = async () => {
      const results = await Promise.allSettled(
        datos.barbers.map((item) => publicoApi.estadoLocal(item.id)),
      );
      if (!active) return;
      setEstadosLocal(Object.fromEntries(
        results
          .map((result, index) => (
            result.status === "fulfilled"
              ? [datos.barbers[index].id, result.value]
              : null
          ))
          .filter(Boolean),
      ));
    };
    cargarEstados();
    const timer = window.setInterval(cargarEstados, 5 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [datos.barbers, esRutaLegal]);

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

  const irAReserva = useCallback(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelector("#reserva")?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  const seleccionarBarbero = async (id) => {
    const siguiente = {
      barber_id: id,
      start_min: null,
      request_id: nuevoRequestId(),
    };
    setReserva((actual) => ({ ...actual, ...siguiente }));
    await cargarSlots(siguiente);
  };

  const seleccionarServicio = async (id) => {
    const siguiente = {
      service_id: id,
      start_min: null,
      request_id: nuevoRequestId(),
    };
    setReserva((actual) => ({ ...actual, ...siguiente }));
    await cargarSlots(siguiente);
  };

  const toggleExtra = async (id) => {
    const addon_ids = reserva.addon_ids.includes(id)
      ? reserva.addon_ids.filter((item) => item !== id)
      : [...reserva.addon_ids, id];
    setReserva((actual) => ({
      ...actual,
      addon_ids,
      start_min: null,
      request_id: nuevoRequestId(),
    }));
    await cargarSlots({ addon_ids, start_min: null });
  };

  const cambiarFecha = async (date) => {
    setReserva((actual) => ({
      ...actual,
      date,
      start_min: null,
      request_id: nuevoRequestId(),
    }));
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
      if (recordarContacto) {
        localStorage.setItem(CONTACT_KEY, JSON.stringify({
          client_name: reserva.client_name.trim(),
          client_phone: telefono,
          client_email: reserva.client_email.trim(),
        }));
      } else {
        localStorage.removeItem(CONTACT_KEY);
      }
      guardarReservaLocal(citaCreada);
      setReservasGuardadas(leerReservasGuardadas());
      setCodigoBusqueda(citaCreada.access_code);
      setCitasCliente([{ ...citaCreada, _access_code: citaCreada.access_code }]);
      publicoApi.fidelidad(citaCreada.access_code)
        .then(setFidelidad)
        .catch(() => setFidelidad(null));
      setCitaConfirmada({
        cita: citaCreada,
        aviso: {
          tipo: "ok",
          titulo: "Reserva confirmada",
          mensaje: "Guardamos tu cita y protegimos el horario.",
        },
      });
      enviarCorreosCita(citaCreada, resumen).catch((error) => {
        console.warn("La confirmación por correo no se pudo completar.", error);
      });
      const limpia = {
        ...nuevaReserva(recordarContacto),
        barber_id: reserva.barber_id,
        service_id: reserva.service_id,
        addon_ids: [],
        date: reserva.date,
      };
      setReserva(limpia);
      await cargarSlots(limpia);
    } catch (error) {
      avisar("error", "No se pudo reservar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const cargarCitaPorCodigo = async (codigo, notificar = true) => {
    const limpio = String(codigo || "").trim().toUpperCase();
    if (limpio.replace(/[^A-Z0-9]/g, "").length < 16) {
      avisar("warning", "Revisa el código", "Debe verse como SB-XXXX-XXXX-XXXX-XXXX.");
      return false;
    }
    setProcesando("Abriendo tu reserva...");
    try {
      const [cita, historial, progreso] = await Promise.all([
        publicoApi.buscarPorCodigo(limpio),
        publicoApi.historialPorCodigo(limpio),
        publicoApi.fidelidad(limpio),
      ]);
      setCodigoBusqueda(limpio);
      setCitasCliente(historial.map((item) => (
        item.id === cita.id
          ? { ...item, _access_code: limpio }
          : item
      )));
      setFidelidad(progreso);
      if (notificar) avisar("ok", "Reserva encontrada");
      return true;
    } catch (error) {
      setCitasCliente([]);
      setFidelidad(null);
      avisar("error", "No encontramos la reserva", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const buscarCitaCodigo = async (event) => {
    event.preventDefault();
    await cargarCitaPorCodigo(codigoBusqueda);
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
      setFidelidad(null);
      avisar("ok", citas.length ? "Encontramos tus citas" : "No hay citas activas");
    } catch (error) {
      avisar("error", "No se pudo buscar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const ejecutarCancelacionCliente = async (cita) => {
    const accessCode = cita._access_code || "";
    if (!accessCode && !telefonoBusqueda) {
      return avisar("warning", "Falta el código de reserva");
    }
    setProcesando("Liberando el espacio...");
    try {
      const actualizada = await publicoApi.cancelarCita(cita.id, {
        access_code: accessCode || null,
        phone: accessCode ? null : telefonoBusqueda,
        reason: "Cancelada desde la web",
      });
      enviarCorreosActualizacion(
        { ...actualizada, access_code: accessCode },
        resumenCorreo(actualizada),
        "cancelled",
      ).catch(() => {});
      if (accessCode) {
        setCitasCliente([{ ...actualizada, _access_code: accessCode }]);
      } else {
        setCitasCliente(await publicoApi.buscarPorTelefono(telefonoBusqueda));
      }
      await cargarSlots();
      avisar("ok", "Cita cancelada");
    } catch (error) {
      avisar("error", "No se pudo cancelar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const cancelarCliente = (cita) => {
    if (!cita?._access_code && !telefonoBusqueda) {
      avisar("warning", "Consulta la reserva antes de continuar");
      return;
    }
    setConfirmacion({
      title: "¿Cancelar esta cita?",
      message: "El horario volverá a quedar disponible para otra persona.",
      confirmLabel: "Sí, cancelar",
      danger: true,
      onConfirm: () => ejecutarCancelacionCliente(cita),
    });
  };

  const cerrarConfirmacionCita = () => {
    const aviso = citaConfirmada?.aviso;
    setCitaConfirmada(null);
    if (aviso) {
      avisar(aviso.tipo, aviso.titulo, aviso.mensaje);
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
      const servicio = datos.services.find((item) => item.id === cita.service_id)
        || datos.services.find((item) => item.name === cita.service_name)
        || datos.services[0];
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
      const servicio = datos.services.find(
        (item) => item.id === modalReprogramar.cita.service_id,
      ) || datos.services.find(
        (item) => item.name === modalReprogramar.cita.service_name,
      ) || datos.services[0];
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
        const accessCode = modalReprogramar.cita._access_code || "";
        const actualizada = await publicoApi.reprogramarCita(modalReprogramar.cita.id, {
          access_code: accessCode || null,
          phone: accessCode ? null : telefonoBusqueda,
          date: modalReprogramar.date,
          start_min: modalReprogramar.start_min,
        });
        enviarCorreosActualizacion(
          { ...actualizada, access_code: accessCode },
          resumenCorreo(actualizada),
          "rescheduled",
        ).catch(() => {});
        if (accessCode) {
          const citaSegura = { ...actualizada, _access_code: accessCode };
          setCitasCliente([citaSegura]);
          guardarReservaLocal({ ...actualizada, access_code: accessCode });
          setReservasGuardadas(leerReservasGuardadas());
        } else {
          setCitasCliente(await publicoApi.buscarPorTelefono(telefonoBusqueda));
        }
      } else {
        const actualizada = await adminApi.moverCita(admin.token, modalReprogramar.cita.id, {
          date: modalReprogramar.date,
          start_min: modalReprogramar.start_min,
        });
        enviarCorreosActualizacion(
          actualizada,
          resumenCorreo(actualizada),
          "rescheduled",
        ).catch(() => {});
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

  const crearListaEspera = async (data) => {
    if (!barberoActivo || !servicioActivo) {
      avisar("warning", "Elige servicio y barbero");
      return false;
    }
    setProcesando("Guardando tu solicitud...");
    try {
      await publicoApi.listaEspera({
        barber_id: barberoActivo.id,
        service_id: servicioActivo.id,
        desired_date: reserva.date,
        ...data,
      });
      avisar(
        "ok",
        "Estás en la lista",
        `Te contactaremos si se libera un espacio el ${reserva.date}.`,
      );
      return true;
    } catch (error) {
      avisar("error", "No se pudo guardar", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const repetirCita = async (cita) => {
    const servicio = datos.services.find((item) => item.id === cita.service_id)
      || datos.services.find((item) => item.name === cita.service_name);
    if (!servicio) {
      avisar("warning", "Ese servicio ya no está disponible");
      return;
    }
    const addonIds = datos.addons
      .filter((item) => cita.addons?.includes(item.name))
      .map((item) => item.id);
    const siguiente = {
      ...nuevaReserva(recordarContacto),
      barber_id: cita.barber_id,
      service_id: servicio.id,
      addon_ids: addonIds,
      client_name: cita.client_name || "",
      client_phone: cita.client_phone || "",
      client_email: cita.client_email || "",
    };
    setReserva(siguiente);
    await cargarSlots(siguiente);
    setPasoSolicitado({ step: 3, key: Date.now() });
    irAReserva();
    avisar("ok", "Reserva preparada", "Solo falta elegir la nueva fecha y hora.");
  };

  const crearReseña = async (data) => {
    setProcesando("Enviando tu reseña...");
    try {
      await publicoApi.crearReseña(data);
      avisar("ok", "Gracias por tu reseña", "Se publicará después de revisarla.");
      return true;
    } catch (error) {
      avisar("error", "No se pudo enviar", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const crearEncuesta = async (data) => {
    setProcesando("Guardando tu opinión...");
    try {
      await publicoApi.crearEncuesta(data);
      avisar("ok", "Gracias por ayudarnos", "Tu respuesta es privada.");
      return true;
    } catch (error) {
      avisar("error", "No se pudo enviar", error.message);
      return false;
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

  const cambiarTabAdmin = (tab) => {
    setAdmin((actual) => ({ ...actual, tab }));
  };

  const filtrarAdmin = async (filtros) => {
    const limpiar = Object.fromEntries(
      Object.entries(filtros).filter(([, valor]) => valor !== ""),
    );
    setAdmin((actual) => ({ ...actual, filtros }));
    try {
      const citas = await adminApi.citas(admin.token, limpiar);
      setAdmin((actual) => ({ ...actual, citas }));
    } catch (error) {
      avisar("error", "No pudimos filtrar la agenda", error.message);
    }
  };

  const cambiarEstadoAdmin = async (id, status) => {
    setProcesando("Actualizando agenda...");
    try {
      const actualizada = await adminApi.estadoCita(admin.token, id, status);
      if (status === "cancelled" && actualizada.client_email) {
        enviarCorreosActualizacion(
          actualizada,
          resumenCorreo(actualizada),
          "cancelled",
        ).catch(() => {});
      }
      await cargarAdmin();
      await cargarSlots();
      avisar("ok", "Agenda actualizada");
    } catch (error) {
      avisar("error", "No se pudo actualizar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const solicitarEstadoAdmin = (id, status) => {
    if (!["cancelled", "no_show"].includes(status)) {
      cambiarEstadoAdmin(id, status);
      return;
    }
    const cita = [...admin.citas, ...admin.bloqueos].find((item) => item.id === id);
    const esBloqueo = cita?.status === "blocked";
    setConfirmacion({
      title: esBloqueo
        ? "¿Liberar este horario?"
        : status === "no_show"
          ? "¿Marcar como ausencia?"
          : "¿Cancelar esta cita?",
      message: esBloqueo
        ? "El espacio volverá a aparecer disponible en la agenda."
        : status === "no_show"
          ? "La cita quedará registrada como no asistida."
          : "La reserva se cancelará y el horario quedará libre.",
      confirmLabel: esBloqueo
        ? "Liberar horario"
        : status === "no_show"
          ? "Marcar ausencia"
          : "Cancelar cita",
      danger: true,
      onConfirm: () => cambiarEstadoAdmin(id, status),
    });
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

  const crearAusencia = async (data) => {
    setProcesando("Guardando disponibilidad...");
    try {
      await adminApi.crearAusencia(admin.token, data);
      await cargarAdmin();
      await cargarSlots();
      avisar("ok", "Disponibilidad actualizada");
      return true;
    } catch (error) {
      avisar("error", "No se pudo guardar", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const eliminarAusencia = async (id) => {
    setProcesando("Actualizando agenda...");
    try {
      await adminApi.eliminarAusencia(admin.token, id);
      await cargarAdmin();
      await cargarSlots();
      avisar("ok", "Ausencia eliminada");
    } catch (error) {
      avisar("error", "No se pudo eliminar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const bloquearProximoEspacio = async () => {
    setProcesando("Buscando el próximo espacio...");
    try {
      const bloqueo = await adminApi.bloqueoRapido(admin.token, {
        duration_min: 45,
        horizon_days: 14,
        notes: "Bloqueo rápido desde el panel",
      });
      await cargarAdmin();
      await cargarSlots();
      avisar("ok", "Espacio bloqueado", fechaHumana(bloqueo.starts_at));
    } catch (error) {
      avisar("error", "No se pudo crear el bloqueo", error.message);
    } finally {
      setProcesando("");
    }
  };

  const elegirEstilo = async (estilo) => {
    const referencia = `Referencia: ${estilo.nombre}`;
    setReserva((actual) => ({
      ...actual,
      barber_id: estilo.barber_id || actual.barber_id,
      start_min: estilo.barber_id && estilo.barber_id !== actual.barber_id
        ? null
        : actual.start_min,
      notes: actual.notes.includes(referencia)
        ? actual.notes
        : [referencia, actual.notes].filter(Boolean).join(". ").slice(0, 240),
    }));
    if (estilo.barber_id) {
      await cargarSlots({ barber_id: estilo.barber_id, start_min: null });
    }
    avisar("ok", "Referencia guardada", "La verás en el último paso de tu reserva.");
    irAReserva();
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

  const refrescarOperacion = async (publica = false) => {
    const tasks = [cargarAdmin()];
    if (publica) tasks.push(publicoApi.iniciar());
    const results = await Promise.all(tasks);
    const bootstrap = results[1];
    if (bootstrap) {
      setDatos((actual) => ({
        ...actual,
        barbers: normalizarBarberos(bootstrap.barbers || []),
        business_hours: bootstrap.business_hours || [],
        business_breaks: bootstrap.business_breaks || [],
        promotions: bootstrap.promotions || [],
      }));
    }
  };

  const ejecutarOperacion = async ({
    loading,
    action,
    success,
    publica = false,
  }) => {
    setProcesando(loading);
    try {
      await action();
      await refrescarOperacion(publica);
      avisar("ok", success);
      return true;
    } catch (error) {
      avisar("error", "No se pudo completar", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const guardarConfiguracion = (data) => ejecutarOperacion({
    loading: "Guardando configuración...",
    action: () => adminApi.guardarConfiguracion(admin.token, data),
    success: "Configuración guardada",
    publica: true,
  });

  const crearPausa = (data) => ejecutarOperacion({
    loading: "Añadiendo pausa...",
    action: () => adminApi.crearPausa(admin.token, data),
    success: "Pausa añadida",
    publica: true,
  });

  const eliminarPausa = (item) => setConfirmacion({
    title: "¿Eliminar esta pausa?",
    message: `${item.label} dejará de bloquear ese horario semanal.`,
    confirmLabel: "Eliminar pausa",
    danger: true,
    onConfirm: () => ejecutarOperacion({
      loading: "Eliminando pausa...",
      action: () => adminApi.eliminarPausa(admin.token, item.id),
      success: "Pausa eliminada",
      publica: true,
    }),
  });

  const crearPromocion = (data) => ejecutarOperacion({
    loading: "Publicando promoción...",
    action: () => adminApi.crearPromocion(admin.token, data),
    success: "Promoción publicada",
    publica: true,
  });

  const alternarPromocion = (item) => ejecutarOperacion({
    loading: "Actualizando promoción...",
    action: () => adminApi.editarPromocion(admin.token, item.id, {
      is_active: !item.is_active,
    }),
    success: item.is_active ? "Promoción pausada" : "Promoción activada",
    publica: true,
  });

  const eliminarPromocion = (item) => setConfirmacion({
    title: "¿Eliminar esta promoción?",
    message: `"${item.name}" desaparecerá del cálculo de precios.`,
    confirmLabel: "Eliminar promoción",
    danger: true,
    onConfirm: () => ejecutarOperacion({
      loading: "Eliminando promoción...",
      action: () => adminApi.eliminarPromocion(admin.token, item.id),
      success: "Promoción eliminada",
      publica: true,
    }),
  });

  const crearGasto = (data) => ejecutarOperacion({
    loading: "Guardando gasto...",
    action: () => adminApi.crearGasto(admin.token, data),
    success: "Gasto registrado",
  });

  const eliminarGasto = (item) => setConfirmacion({
    title: "¿Eliminar este gasto?",
    message: `${item.description} por ${item.amount} colones saldrá del reporte.`,
    confirmLabel: "Eliminar gasto",
    danger: true,
    onConfirm: () => ejecutarOperacion({
      loading: "Eliminando gasto...",
      action: () => adminApi.eliminarGasto(admin.token, item.id),
      success: "Gasto eliminado",
    }),
  });

  const crearCierre = (data) => ejecutarOperacion({
    loading: "Cerrando caja...",
    action: () => adminApi.crearCierre(admin.token, data),
    success: "Cierre diario guardado",
  });

  const actualizarCliente = (id, data) => ejecutarOperacion({
    loading: "Guardando ficha...",
    action: () => adminApi.actualizarCliente(admin.token, id, data),
    success: "Ficha actualizada",
  });

  const canjearFidelidad = (cliente) => ejecutarOperacion({
    loading: "Registrando beneficio...",
    action: () => adminApi.canjearFidelidad(admin.token, cliente.profile_id),
    success: "Beneficio canjeado",
  });

  const anonimizarCliente = (cliente) => setConfirmacion({
    title: "¿Eliminar los datos personales?",
    message: (
      `Se borrarán el nombre, teléfono, correo y notas de ${cliente.name}. `
      + "Los totales históricos se conservarán sin identificar a la persona."
    ),
    confirmLabel: "Eliminar datos",
    danger: true,
    onConfirm: () => ejecutarOperacion({
      loading: "Anonimizando cliente...",
      action: () => adminApi.anonimizarCliente(admin.token, cliente.profile_id),
      success: "Datos personales eliminados",
    }),
  });

  const descargarRespaldo = async () => {
    setProcesando("Preparando respaldo...");
    try {
      const payload = await adminApi.respaldo(admin.token);
      const blob = new Blob(
        [JSON.stringify(payload, null, 2)],
        { type: "application/json;charset=utf-8" },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `respaldo-sebas-barber-${hoyISO()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      avisar("ok", "Respaldo descargado");
    } catch (error) {
      avisar("error", "No se pudo descargar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const cambiarEstadoListaEspera = async (id, status) => {
    setProcesando("Actualizando la lista...");
    try {
      await adminApi.estadoListaEspera(admin.token, id, status);
      await cargarAdmin();
      avisar("ok", "Lista de espera actualizada");
    } catch (error) {
      avisar("error", "No se pudo actualizar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const moderarReseña = async (id, status) => {
    setProcesando("Guardando la reseña...");
    try {
      await adminApi.estadoReseña(admin.token, id, status);
      const [reviews] = await Promise.all([
        publicoApi.reseñas(),
        cargarAdmin(),
      ]);
      setDatos((actual) => ({ ...actual, reviews: reviews.items || [] }));
      avisar("ok", status === "approved" ? "Reseña publicada" : "Reseña archivada");
    } catch (error) {
      avisar("error", "No se pudo moderar", error.message);
    } finally {
      setProcesando("");
    }
  };

  const crearImagenGaleria = async (data) => {
    setProcesando("Añadiendo trabajo...");
    try {
      await adminApi.crearImagen(admin.token, data);
      const bootstrap = await publicoApi.iniciar();
      setDatos((actual) => ({ ...actual, gallery: bootstrap.gallery || [] }));
      await cargarAdmin();
      avisar("ok", "Imagen añadida");
      return true;
    } catch (error) {
      avisar("error", "No se pudo añadir", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const subirImagenGaleria = async (formData) => {
    setProcesando("Subiendo imagen...");
    try {
      await adminApi.subirImagen(admin.token, formData);
      const bootstrap = await publicoApi.iniciar();
      setDatos((actual) => ({ ...actual, gallery: bootstrap.gallery || [] }));
      await cargarAdmin();
      avisar("ok", "Imagen publicada");
      return true;
    } catch (error) {
      avisar("error", "No se pudo subir", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const editarImagenGaleria = async (id, data) => {
    setProcesando("Actualizando galería...");
    try {
      await adminApi.editarImagen(admin.token, id, data);
      const bootstrap = await publicoApi.iniciar();
      setDatos((actual) => ({ ...actual, gallery: bootstrap.gallery || [] }));
      await cargarAdmin();
      avisar("ok", "Galería actualizada");
      return true;
    } catch (error) {
      avisar("error", "No se pudo actualizar", error.message);
      return false;
    } finally {
      setProcesando("");
    }
  };

  const eliminarImagenGaleria = (item) => {
    setConfirmacion({
      title: "¿Eliminar esta imagen?",
      message: `"${item.title}" dejará de aparecer en el sitio.`,
      confirmLabel: "Eliminar imagen",
      danger: true,
      onConfirm: async () => {
        setProcesando("Eliminando imagen...");
        try {
          await adminApi.eliminarImagen(admin.token, item.id);
          const bootstrap = await publicoApi.iniciar();
          setDatos((actual) => ({ ...actual, gallery: bootstrap.gallery || [] }));
          await cargarAdmin();
          avisar("ok", "Imagen eliminada");
        } catch (error) {
          avisar("error", "No se pudo eliminar", error.message);
        } finally {
          setProcesando("");
        }
      },
    });
  };

  if (esRutaLegal) {
    return (
      <Suspense fallback={<main className="pantalla-carga"><span className="spinner grande" /></main>}>
        <LegalPage path={ruta} />
      </Suspense>
    );
  }

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
    onEstado: solicitarEstadoAdmin,
    onMover: (cita) => abrirReprogramar(cita, "admin"),
    onBloqueo: crearBloqueo,
    onAusencia: crearAusencia,
    onEliminarAusencia: eliminarAusencia,
    onGuardarServicio: guardarServicio,
    onGuardarHorario: guardarHorario,
    onChangePassword: cambiarPassword,
    onBloqueoRapido: bloquearProximoEspacio,
    onEstadoListaEspera: cambiarEstadoListaEspera,
    onModerarReseña: moderarReseña,
    onCrearImagen: crearImagenGaleria,
    onSubirImagen: subirImagenGaleria,
    onEditarImagen: editarImagenGaleria,
    onEliminarImagen: eliminarImagenGaleria,
    onGuardarConfiguracion: guardarConfiguracion,
    onCrearPausa: crearPausa,
    onEliminarPausa: eliminarPausa,
    onCrearPromocion: crearPromocion,
    onAlternarPromocion: alternarPromocion,
    onEliminarPromocion: eliminarPromocion,
    onCrearGasto: crearGasto,
    onEliminarGasto: eliminarGasto,
    onCrearCierre: crearCierre,
    onDescargarRespaldo: descargarRespaldo,
    onActualizarCliente: actualizarCliente,
    onCanjearFidelidad: canjearFidelidad,
    onAnonimizarCliente: anonimizarCliente,
  };

  if (ruta.startsWith("/admin")) {
    return (
      <>
        <main className="admin-route">
          <Suspense fallback={<div className="pantalla-carga"><span className="spinner grande" /></div>}>
            <AdminPanel {...adminProps} standalone />
          </Suspense>
        </main>
        {procesando && (
          <div className="loader-global">
            <div>
              <span className="spinner grande" />
              <p>{procesando}</p>
            </div>
          </div>
        )}
        <RescheduleModal
          data={modalReprogramar}
          onClose={() => setModalReprogramar(null)}
          onDate={cambiarFechaModal}
          onSlot={(startMin) => setModalReprogramar((actual) => ({ ...actual, start_min: startMin }))}
          onConfirm={confirmarReprogramacion}
        />
        <ConfirmDialog
          config={confirmacion}
          onCancel={() => setConfirmacion(null)}
          onConfirm={confirmarAccion}
        />
        <Toasts items={toastList} onClose={cerrarToast} />
      </>
    );
  }

  return (
    <>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <Navbar abierto={menuAbierto} solida={navSolida} onToggle={() => setMenuAbierto((value) => !value)} />
      <main id="contenido">
        <Hero
          barberos={datos.barbers}
          barbero={barberoActivo}
          primerSlot={slots[0]?.label}
          estados={estadosLocal}
          onMapa={() => setModalMapa(true)}
        />
        <TeamSection
          barberos={datos.barbers}
          seleccionado={reserva.barber_id}
          estados={estadosLocal}
          onSeleccionar={seleccionarBarbero}
          onContinuar={irAReserva}
        />
        <ServiceMenu
          servicios={datos.services}
          extras={datos.addons}
          reserva={reserva}
          onServicio={seleccionarServicio}
          onExtra={toggleExtra}
          onContinuar={irAReserva}
        />
        <Gallery items={datos.gallery} onElegirEstilo={elegirEstilo} />
        <ReviewsSection reviews={datos.reviews} />
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
          onWaitlist={crearListaEspera}
          pasoSolicitado={pasoSolicitado}
          recordarContacto={recordarContacto}
          onRecordarContacto={setRecordarContacto}
        />
        <ClientAppointments
          codigo={codigoBusqueda}
          setCodigo={setCodigoBusqueda}
          telefono={telefonoBusqueda}
          setTelefono={setTelefonoBusqueda}
          citas={citasCliente}
          barberos={datos.barbers}
          reservasGuardadas={reservasGuardadas}
          fidelidad={fidelidad}
          onBuscarCodigo={buscarCitaCodigo}
          onBuscarTelefono={buscarCitas}
          onSeleccionarGuardada={(codigo) => cargarCitaPorCodigo(codigo)}
          onCancelar={cancelarCliente}
          onReprogramar={(cita) => abrirReprogramar(cita, "cliente")}
          onRepetir={repetirCita}
          onReseña={crearReseña}
          onEncuesta={crearEncuesta}
        />
        <FaqSection />
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
            <a href="#preguntas">Preguntas</a>
            <a href="#ubicacion">Ubicación</a>
            <a href="/privacidad">Privacidad</a>
            <a href="/terminos-reserva">Términos</a>
            <a href="/aviso-cancelacion">Cancelaciones</a>
          </nav>
        </div>
        <div className="footer-legal">
          <small>© {new Date().getFullYear()} Sebas Barber. Todos los derechos reservados.</small>
          <small className="footer-credit">
            <Code2 size={14} />
            Desarrollado por <span>Dylan Calvo Escobar</span> · Innovación y tecnología.
          </small>
        </div>
      </footer>
      <FloatingContact barberos={datos.barbers} seleccionado={reserva.barber_id} />
      <ScrollToTop />
      {modalMapa && <MapModal location={datos.location} onClose={() => setModalMapa(false)} />}
      {citaConfirmada && (
        <BookingSuccessModal
          cita={citaConfirmada.cita}
          barbero={datos.barbers.find((item) => item.id === citaConfirmada.cita.barber_id)}
          onClose={cerrarConfirmacionCita}
        />
      )}
      <RescheduleModal
        data={modalReprogramar}
        onClose={() => setModalReprogramar(null)}
        onDate={cambiarFechaModal}
        onSlot={(startMin) => setModalReprogramar((actual) => ({ ...actual, start_min: startMin }))}
        onConfirm={confirmarReprogramacion}
      />
      {procesando && (
        <div className="loader-global">
          <div>
            <span className="spinner grande" />
            <p>{procesando}</p>
          </div>
        </div>
      )}
      <ConfirmDialog
        config={confirmacion}
        onCancel={() => setConfirmacion(null)}
        onConfirm={confirmarAccion}
      />
      <Toasts items={toastList} onClose={cerrarToast} />
    </>
  );
}
