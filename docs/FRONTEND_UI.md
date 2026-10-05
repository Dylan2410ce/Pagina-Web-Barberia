# Interfaz y pruebas visuales

## Responsabilidades

- `src/App.jsx` selecciona las rutas. `PublicApp.jsx` coordina la experiencia pública y `admin/AdminWorkspace.jsx` carga el panel bajo demanda, con sus propios controladores.
- `components/BookingWizard.jsx` presenta los pasos de reserva. `booking/BookingDetails.jsx` valida los datos de contacto y evita envíos simultáneos desde el formulario.
- `components/AdminPanel.jsx` selecciona la vista administrativa. Cada módulo de `components/admin/` presenta una responsabilidad: agenda, servicios, clientes, bloqueos, horarios, reportes o seguridad.
- `hooks/useAdminController.js` conserva las operaciones de escritura. `useAdminData.js` consulta únicamente los recursos de la vista activa, registra errores y fechas de actualización por recurso e invalida los datos tras una modificación. Las respuestas de consultas reemplazadas o de sesiones cerradas no actualizan la interfaz.
- `components/ui/` contiene campos, diálogos, búsquedas, menús de acciones y estados vacíos reutilizables.

La API sigue siendo la autoridad para precios, autorización, validación de reservas y aislamiento por barbero. Los filtros locales solo operan sobre los registros que el servidor ya autorizó. El proveedor de correo se configura solo en el backend; el bundle del frontend no contiene claves ni SDK de envío.

## Estilos

`src/styles.css` declara el orden de la cascada. Los tokens de color, espaciado y tipografía viven en `styles/base.css`. La capa compartida está en `ui.css`; las composiciones pública y administrativa están en `public-layout.css` y `admin-layout.css`.

Los estilos de mantenimiento deben limitarse a sus clases `maintenance-*`. No agregar allí reglas generales de formularios, secciones o tipografía, pues afectarían el sitio operativo.

Se utiliza Inter para títulos y lectura, con fuentes de sistema como alternativa. La paleta combina gris mineral `#e9edf1`, superficies `#f3f5f7` y texto tinta `#202833`; las acciones principales usan azul petróleo `#165c72`. Verde confirma una acción y rojo señala errores o acciones destructivas. `light-surfaces.css` unifica los módulos secundarios y diálogos que comparten la misma paleta.

Los controles incluyen etiquetas visibles, áreas táctiles de al menos 44 px, foco visible y estados de error con texto, no solo color. Las animaciones respetan `prefers-reduced-motion`. La navegación cambia a menú desplegable por debajo de 960 px; el administrador muestra accesos a Hoy, Bloquear y Clientes, más herramientas agrupadas en Más, por debajo de 1040 px. En escritorio `AdminNavigation` agrupa Día a día, Negocio, Contenido y Mi cuenta. El resumen inicia con las citas por atender; Todas recupera el día completo. El bloqueo rápido confirma antes de bloquear 45 minutos en el siguiente espacio **de hoy**, sin desplazar citas ni bloquear otros días. El catálogo compartido es editable por Sebastián y de lectura para Gabriel; la API valida esta autorización independientemente de los botones.

Para una revisión visual aislada, `python scripts/preview_local.py` desde `backend` genera una base temporal con clientes ficticios y una contraseña temporal. La API se limita a `127.0.0.1:8008`; no envía correos ni llama a Calendar. Iniciar Vite con `VITE_API_URL=http://127.0.0.1:8008`. Esta utilidad no forma parte del arranque de producción.

## Contratos de interacción

- La reserva aparece inmediatamente después de la portada. El catálogo y los perfiles mantienen sus enlaces en la navegación, sin anteponerse al formulario principal.
- El estado de atención de todos los barberos se consulta en una sola petición a `/api/public/shop-status`, sin multiplicar llamadas HTTP por cada nuevo perfil. Las consultas de PostgreSQL del estado agrupado son constantes (cuatro), no una cadena por barbero.
- `BookingDateShortcuts` ofrece tres fechas cercanas de atención, sin afirmar que tengan espacios libres: la API confirma sus horarios al seleccionarlas. La entrada de fecha conserva acceso a cualquier otro día.
- Recordar el barbero es opcional y almacena solamente su identificador en este dispositivo. Un perfil retirado no se preselecciona.
- `AdminTeam` se descarga bajo demanda. Su búsqueda y filtro de actividad son locales; la API exige al propietario en todas las operaciones. Los errores de guardado permanecen en el diálogo y se bloquean envíos simultáneos.
- El primer cliente pendiente se destaca con acciones directas Atendido y No llegó; ambas reutilizan la confirmación y autorización de la agenda.

- `FormField` valida al salir del campo y durante la edición posterior. La validación final permanece en el formulario y en el servidor.
- `Dialog` y `useDialogA11y` administran Escape, foco inicial, confinamiento del foco y restauración al cerrar. El callback de cierre puede cambiar sin reiniciar el foco.
- `ActionMenu` admite flechas, Inicio/Fin y Escape. Se abre hacia arriba cuando el espacio inferior es insuficiente.
- Los avisos de `Toasts` pausan su cierre automático mientras reciben foco o el cursor está encima.
- La agenda consulta al servidor cuando cambia la fecha. Búsqueda y estado filtran localmente sin generar una petición por cada tecla. Exportar CSV utiliza el conjunto filtrado.
- La edición de servicios ocurre en un diálogo y se cierra únicamente cuando el controlador confirma que el guardado fue exitoso.
- `AdminDashboard` presenta tres indicadores y la agenda del día como una lista, sin tablas. `AppointmentActions` comparte las acciones entre el resumen y la agenda completa. «Atendido» y «No llegó» abren una confirmación; solo aceptarla invoca la API. La zona horaria de fechas y horas sigue siendo `America/Costa_Rica`.
- `BookingReview` muestra servicio, barbero, fecha, total y condiciones antes de confirmar. La navegación entre pasos mueve el foco al título; editar una selección conserva los datos de contacto.
- Un fallo al consultar horarios no se representa como agenda llena. Hay un aviso persistente y un reintento. Si falla la respuesta al crear una reserva, el controlador conserva en memoria el mismo payload y `request_id`; «Comprobar reserva» reutiliza la idempotencia del servidor. No recargar la página mientras se comprueba: esta recuperación pendiente no persiste tras recargar.
- Guardar datos de contacto y guardar el código de acceso son consentimientos separados. «Olvidar» elimina solo el acceso almacenado en ese navegador; no cancela la cita.
- `ManualAppointment` crea citas desde la agenda autenticada. No permite elegir otro barbero y reutiliza la validación transaccional del servidor. Los errores inciertos conservan la misma solicitud para reintentar sin duplicar.
- `AdminBlocks` exige una consulta de impacto y una confirmación posterior. Si cambian las fechas u horas, invalida la revisión. La vista previa consulta citas locales activas; la creación definitiva vuelve a comprobar las reglas de disponibilidad, incluido Calendar. No cancela ni mueve citas automáticamente.
- Los precios del menú ampliado se generan con el catálogo de la API; no dependen de una imagen que pueda quedar desactualizada.

## Verificación local

Desde `frontend`:

```powershell
npm test -- --maxWorkers=2
npm run build
npm run dev -- --host 127.0.0.1
```

`/qa/` está disponible solo en el servidor de desarrollo. Es una vista de prueba con datos sintéticos y sin conexión a la API para revisar el administrador. `/qa/booking.html` permite probar selección, validación y errores de horarios sin crear reservas. No representan un inicio de sesión ni se incluyen como entradas del build de producción. Los cambios allí no persisten.

Revisar 320, 375, 768 y 1280 px: ausencia de desbordamiento horizontal, navegación móvil, selección de servicio, campos inválidos, apertura/cierre de diálogos, búsqueda de citas, menús junto al borde inferior y estados vacíos. Verificar también navegación con teclado y movimiento reducido.

Las pruebas automatizadas cubren reserva, validación, selección, búsquedas, edición de servicios, accesibilidad de diálogos y menús. No envían correos ni crean citas en producción.

## Despliegue

Esta actualización requiere Alembic `20261004_01`, ejecutado por el comando de arranque de Render; no requiere variables nuevas. Vercel compila `frontend`. Tras publicar, comparar el SHA del HTML y `/health` en Render con el commit esperado. `/health/ready` verifica la conexión y las migraciones.
