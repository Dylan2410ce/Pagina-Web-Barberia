import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import { obtenerToken, publicoApi } from "./api/client";
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
import RescheduleModal from "./components/RescheduleModal";
import ReviewsSection from "./components/ReviewsSection";
import ServiceMenu from "./components/ServiceMenu";
import ScrollToTop from "./components/ScrollToTop";
import Footer from "./components/Footer";
import DeferredSection from "./components/DeferredSection";
import AgendaLoading from "./components/AgendaLoading";
import { UBICACION } from "./config/business";
import TeamSection from "./components/TeamSection";
import Toasts from "./components/Toasts";
import useMaintenanceStatus from "./hooks/useMaintenanceStatus";
import useAdminController from "./hooks/useAdminController";
import useBookingState from "./hooks/useBookingState";
import useClientBookings from "./hooks/useClientBookings";
import { hoyISO } from "./utils/format";
import { normalizarBarberos } from "./utils/barbers";
import {
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
import { nuevaReserva, codigoReservaDesdeUrl } from "./utils/bookingDraft";

export default function App() {
  const [ruta, setRuta] = useState(() => window.location.pathname);
  const esRutaLegal = LEGAL_ROUTES.has(ruta);
  const esRutaAdmin = ruta.startsWith("/admin");
  const mantenimiento = useMaintenanceStatus(!esRutaAdmin);
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

  const { reserva, setReserva, recordarContacto, setRecordarContacto, slots, cargandoSlots, cargarSlots, servicioActivo, extrasActivos, barberoActivo, horariosActivos, resumen, seleccionarBarbero, seleccionarServicio, toggleExtra, cambiarFecha } = useBookingState(datos, avisar);

  const { admin, cargarAdmin, loginAdmin, resetPassword, cambiarPassword, cerrarAdmin, cambiarTabAdmin, filtrarAdmin, cambiarEstadoAdmin, solicitarEstadoAdmin, crearBloqueo, crearAusencia, eliminarAusencia, bloquearProximoEspacio, guardarServicio, guardarHorario, refrescarOperacion, ejecutarOperacion, guardarConfiguracion, crearPausa, eliminarPausa, crearPromocion, alternarPromocion, eliminarPromocion, crearGasto, eliminarGasto, crearCierre, actualizarCliente, anonimizarCliente, descargarRespaldo, cambiarEstadoListaEspera, crearImagenGaleria, subirImagenGaleria, editarImagenGaleria, eliminarImagenGaleria, moderarReseña } = useAdminController({
    avisar, setProcesando, setConfirmacion, setDatos, cargarSlots,
  });

  useEffect(() => {
    if (esRutaAdmin) {
      setCargando(false);
      const tokenGuardado = obtenerToken();
      if (tokenGuardado) {
        cargarAdmin(tokenGuardado, { date: hoyISO(), status: "", q: "" });
      }
      return undefined;
    }

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
        setReserva(nuevaReserva);
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
    esRutaAdmin,
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

  const { crearCita, cargarCitaPorCodigo, buscarCitaCodigo, ejecutarCancelacionCliente, cancelarCliente, cerrarConfirmacionCita, abrirReprogramar, cambiarFechaModal, confirmarReprogramacion, crearListaEspera, repetirCita, crearReseña, crearEncuesta, elegirEstilo } = useClientBookings({ reserva, recordarContacto, barberoActivo, servicioActivo, datos, admin, codigoBusqueda, citaConfirmada, modalReprogramar, avisar, setProcesando, setReserva, setReservasGuardadas, setCodigoBusqueda, setCitasCliente, setCitaConfirmada, setConfirmacion, setModalReprogramar, setPasoSolicitado, cargarSlots, cargarAdmin, irAReserva });

  if (!esRutaAdmin && mantenimiento.maintenance_enabled) {
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
    onAnonimizarCliente: anonimizarCliente,
  };

  if (esRutaAdmin) {
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
        {(cargando || errorAgenda) ? (
          <AgendaLoading error={errorAgenda} onRetry={() => setIntentoCarga((valor) => valor + 1)} />
        ) : (<>
        <TeamSection
          barberos={datos.barbers}
          estados={estadosLocal}
        />
        <ServiceMenu
          servicios={datos.services}
          extras={datos.addons}
          onSeleccionar={(id) => {
            seleccionarServicio(id);
            setPasoSolicitado({ step: 1, key: Date.now() });
            irAReserva();
          }}
        />
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
        </>)}
        <DeferredSection>
          <Suspense fallback={<div className="section-placeholder" aria-label="Cargando galería" />}>
            <Gallery items={datos.gallery} onElegirEstilo={elegirEstilo} />
          </Suspense>
        </DeferredSection>
        <ReviewsSection reviews={datos.reviews} />
        <ClientAppointments
          codigo={codigoBusqueda}
          setCodigo={setCodigoBusqueda}
          citas={citasCliente}
          barberos={datos.barbers}
          reservasGuardadas={reservasGuardadas}
          onBuscarCodigo={buscarCitaCodigo}
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
      <Footer />
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
