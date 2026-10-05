import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import { publicoApi } from "./api/client";
const BookingSuccessModal = lazy(() => import("./components/BookingSuccessModal"));
import BookingWizard from "./components/BookingWizard";
import ClientAppointments from "./components/ClientAppointments";
import ConfirmDialog from "./components/ConfirmDialog";
import FaqSection from "./components/FaqSection";
import FloatingContact from "./components/FloatingContact";
const Gallery = lazy(() => import("./components/Gallery"));
import Hero from "./components/Hero";
import LocationSection from "./components/LocationSection";
import MaintenancePage from "./components/MaintenancePage";
const MapModal = lazy(() => import("./components/MapModal"));
import Navbar from "./components/Navbar";
const RescheduleModal = lazy(() => import("./components/RescheduleModal"));
const ReviewsSection = lazy(() => import("./components/ReviewsSection"));
import ServiceMenu from "./components/ServiceMenu";
import ScrollToTop from "./components/ScrollToTop";
import Footer from "./components/Footer";
import DeferredSection from "./components/DeferredSection";
import AgendaLoading from "./components/AgendaLoading";
import { UBICACION } from "./config/business";
import TeamSection from "./components/TeamSection";
import Toasts from "./components/Toasts";
import useMaintenanceStatus from "./hooks/useMaintenanceStatus";
import useBookingState from "./hooks/useBookingState";
import useClientBookings from "./hooks/useClientBookings";
import { hoyISO } from "./utils/format";
import { normalizarBarberos } from "./utils/barbers";
import { leerBarberoPreferido } from "./hooks/useBarberPreference";
import useRevealAnimation from "./hooks/useRevealAnimation";
import {
  leerReservasGuardadas,
  ultimaReservaGuardada,
} from "./utils/bookingStorage";
import { normalizarServicios } from "./utils/services";

const LegalPage = lazy(() => import("./components/LegalPage"));
const LEGAL_ROUTES = new Set([
  "/privacidad",
  "/terminos-reserva",
  "/aviso-cancelacion",
]);
import { nuevaReserva, codigoReservaDesdeUrl } from "./utils/bookingDraft";

export default function PublicApp() {
  useRevealAnimation();
  const [ruta, setRuta] = useState(() => window.location.pathname);
  const esRutaLegal = LEGAL_ROUTES.has(ruta);
  const mantenimiento = useMaintenanceStatus(true);
  const [datos, setDatos] = useState({
    barbers: [],
    services: [],
    addons: [],
    business_hours: [],
    business_breaks: [],
    promotions: [],
    reviews: [],
    gallery: [],
    location: UBICACION,
  });
  const [estadosLocal, setEstadosLocal] = useState({});
  const [cargando, setCargando] = useState(!esRutaLegal);
  const [errorAgenda, setErrorAgenda] = useState("");
  const [intentoCarga, setIntentoCarga] = useState(0);
  const [procesando, setProcesando] = useState("");
  const [toastList, setToastList] = useState([]);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [navSolida, setNavSolida] = useState(false);
  const [modalMapa, setModalMapa] = useState(false);
  const [codigoBusqueda, setCodigoBusqueda] = useState(() => (
    codigoReservaDesdeUrl()
    || ultimaReservaGuardada()?.access_code
    || ""
  ));
  const [citasCliente, setCitasCliente] = useState([]);
  const [reservasGuardadas, setReservasGuardadas] = useState(
    leerReservasGuardadas,
  );
  const [pasoSolicitado, setPasoSolicitado] = useState(null);
  const [modalReprogramar, setModalReprogramar] = useState(null);
  const [citaConfirmada, setCitaConfirmada] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const [recordarReserva, setRecordarReserva] = useState(false);

  const avisar = useCallback((tipo, titulo, mensaje = "") => {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    setToastList((items) => [...items.slice(-2), { id, tipo, titulo, mensaje }]);
  }, []);

  const cerrarToast = useCallback((id) => setToastList((items) => items.filter((item) => item.id !== id)), []);

  const confirmarAccion = () => {
    const accion = confirmacion?.onConfirm;
    setConfirmacion(null);
    accion?.();
  };

  const { reserva, setReserva, recordarContacto, setRecordarContacto, slots, cargandoSlots, errorSlots, cargarSlots, servicioActivo, barberoActivo, horariosActivos, resumen, seleccionarBarbero, seleccionarServicio, toggleExtra, cambiarFecha } = useBookingState(datos, avisar);

  useEffect(() => {
    if (
      esRutaLegal
      || mantenimiento.loading
      || mantenimiento.maintenance_enabled
    ) {
      return undefined;
    }

    let activo = true;
    async function iniciar() {
      setCargando(true);
      setErrorAgenda("");
      try {
        const bootstrap = await publicoApi.iniciar();
        if (!activo) return;
        const barbers = normalizarBarberos(bootstrap.barbers || []);
        const normalizados = {
          ...bootstrap,
          location: { ...UBICACION, ...bootstrap.location },
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
        const preferido = leerBarberoPreferido();
        setReserva({ ...nuevaReserva(), barber_id: barbers.some((item) => item.id === preferido) ? preferido : "" });
        setCargando(false);
        const codigoUrl = codigoReservaDesdeUrl();
        if (codigoUrl) {
          try {
            const [cita, historial] = await Promise.all([
              publicoApi.buscarPorCodigo(codigoUrl),
              publicoApi.historialPorCodigo(codigoUrl),
            ]);
            setCodigoBusqueda(codigoUrl);
            setCitasCliente(historial.map((item) => (
              item.id === cita?.id
                ? { ...item, _access_code: codigoUrl }
                : item
            )));
            requestAnimationFrame(() => {
              document.getElementById("mis-citas")?.scrollIntoView({ block: "start" });
            });
          } catch {
            avisar("warning", "Código no encontrado", "Revisa el comprobante de tu reserva.");
          }
        }
      } catch (error) {
        if (!activo) return;
        setCargando(false);
        setErrorAgenda(error.message);
      }
    }
    iniciar();
    return () => { activo = false; };
  }, [
    esRutaLegal,
    mantenimiento.loading,
    mantenimiento.maintenance_enabled,
    intentoCarga,
  ]);

  useEffect(() => {
    if (!datos.barbers.length || esRutaLegal) return undefined;
    let active = true;
    const cargarEstados = async () => {
      if (document.hidden) return;
      try {
        const estados = await publicoApi.estadoEquipo();
        if (active) setEstadosLocal(Object.fromEntries(estados.map((estado) => [estado.barber_id, estado])));
      } catch { /* El estado del local no bloquea la consulta de disponibilidad. */ }
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

  const irAReserva = useCallback(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelector("#reserva")?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  const { crearCita, errorReserva, reservaPendiente, olvidarReserva, cargarCitaPorCodigo, buscarCitaCodigo, cancelarCliente, cerrarConfirmacionCita, abrirReprogramar, cambiarFechaModal, confirmarReprogramacion, crearListaEspera, repetirCita, crearReseña, crearEncuesta, elegirEstilo } = useClientBookings({ reserva, recordarContacto, recordarReserva, barberoActivo, servicioActivo, datos, codigoBusqueda, citaConfirmada, modalReprogramar, avisar, setProcesando, setReserva, setReservasGuardadas, setCodigoBusqueda, setCitasCliente, setCitaConfirmada, setConfirmacion, setModalReprogramar, setPasoSolicitado, cargarSlots, irAReserva });

  if (mantenimiento.maintenance_enabled) {
    return (
      <MaintenancePage
        status={mantenimiento}
        onRefresh={mantenimiento.refresh}
      />
    );
  }

  if (esRutaLegal) {
    return (
      <Suspense fallback={<main className="pantalla-carga"><span className="spinner grande" /></main>}>
        <LegalPage path={ruta} />
      </Suspense>
    );
  }

  return (
    <>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <Navbar abierto={menuAbierto} solida={navSolida} contenidoListo={!cargando} onToggle={() => setMenuAbierto((value) => !value)} />
      <main id="contenido">
        <Hero
          barberos={datos.barbers}
          barbero={barberoActivo}
          primerSlot={slots[0]?.label}
          estados={estadosLocal}
          onMapa={() => setModalMapa(true)}
        />
        {(cargando || errorAgenda) ? (
          <AgendaLoading error={errorAgenda} onRetry={() => setIntentoCarga((valor) => valor + 1)} />
        ) : (<>
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
          errorSlots={errorSlots}
          errorReserva={errorReserva}
          reservaPendiente={reservaPendiente}
          onReintentar={() => cargarSlots()}
          horarios={horariosActivos}
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
          recordarReserva={recordarReserva}
          onRecordarReserva={setRecordarReserva}
        />
        <ServiceMenu
          servicios={datos.services}
          extras={datos.addons}
          onSeleccionar={(id) => {
            if (reservaPendiente) { avisar("warning", "Comprueba tu reserva pendiente", "La confirmación sigue disponible en el formulario."); irAReserva(); return; }
            seleccionarServicio(id);
            setPasoSolicitado({ step: 1, key: Date.now() });
            irAReserva();
          }}
        />
        <TeamSection barberos={datos.barbers} estados={estadosLocal} />
        </>)}
        <DeferredSection>
          <Suspense fallback={<div className="section-placeholder" aria-label="Cargando galería" />}>
            <Gallery items={datos.gallery} onElegirEstilo={elegirEstilo} />
          </Suspense>
        </DeferredSection>
        <DeferredSection><Suspense fallback={<div className="section-placeholder" aria-label="Cargando reseñas" />}><ReviewsSection reviews={datos.reviews} /></Suspense></DeferredSection>
        <ClientAppointments
          codigo={codigoBusqueda}
          setCodigo={setCodigoBusqueda}
          citas={citasCliente}
          barberos={datos.barbers}
          reservasGuardadas={reservasGuardadas}
          onBuscarCodigo={buscarCitaCodigo}
          onSeleccionarGuardada={(codigo) => cargarCitaPorCodigo(codigo)}
          onOlvidar={olvidarReserva}
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
      <Footer location={datos.location} />
      <FloatingContact barberos={datos.barbers} seleccionado={reserva.barber_id} />
      <ScrollToTop />
      {modalMapa && <Suspense fallback={null}><MapModal location={datos.location} onClose={() => setModalMapa(false)} /></Suspense>}
      {citaConfirmada && (
        <Suspense fallback={<div className="loader-global" role="status">Preparando comprobante...</div>}>
        <BookingSuccessModal
          cita={citaConfirmada.cita}
          barbero={datos.barbers.find((item) => item.id === citaConfirmada.cita.barber_id)}
          onClose={cerrarConfirmacionCita}
        />
        </Suspense>
      )}
      {modalReprogramar && <Suspense fallback={<div role="status" className="loader-global">Abriendo horarios…</div>}><RescheduleModal
        data={modalReprogramar}
        onClose={() => setModalReprogramar(null)}
        onDate={cambiarFechaModal}
        onSlot={(startMin) => setModalReprogramar((actual) => ({ ...actual, start_min: startMin }))}
        onConfirm={confirmarReprogramacion}
      /></Suspense>}
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
