# Interfaz y pruebas visuales

## Responsabilidades

- `src/App.jsx` coordina rutas y controladores; no contiene reglas de disponibilidad.
- `components/BookingWizard.jsx` presenta los pasos de reserva. `booking/BookingDetails.jsx` valida los datos de contacto y evita envíos simultáneos desde el formulario.
- `components/AdminPanel.jsx` selecciona la vista administrativa. Cada módulo de `components/admin/` presenta una responsabilidad: agenda, servicios, clientes, bloqueos, horarios, reportes o seguridad.
- `hooks/useAdminController.js` conserva las operaciones HTTP. Las respuestas de consultas reemplazadas o de sesiones cerradas no actualizan la interfaz.
- `components/ui/` contiene campos, diálogos, búsquedas, menús de acciones y estados vacíos reutilizables.

La API sigue siendo la autoridad para precios, autorización, validación de reservas y aislamiento por barbero. Los filtros locales solo operan sobre los registros que el servidor ya autorizó. EmailJS continúa exclusivamente en el backend.

## Estilos

`src/styles.css` declara el orden de la cascada. Los tokens de color, espaciado y tipografía viven en `styles/base.css`. La capa compartida está en `ui.css`; las composiciones pública y administrativa están en `public-layout.css` y `admin-layout.css`.

Los estilos de mantenimiento deben limitarse a sus clases `maintenance-*`. No agregar allí reglas generales de formularios, secciones o tipografía, pues afectarían el sitio operativo.

Se utiliza Inter para títulos y lectura, con fuentes de sistema como alternativa. La paleta combina blanco, gris claro y texto carbón; las acciones principales usan negro sólido. Azul indica selección o foco, verde confirma una acción y rojo señala errores o acciones destructivas. `light-surfaces.css` unifica los módulos secundarios y diálogos que comparten la misma paleta.

Los controles incluyen etiquetas visibles, áreas táctiles de al menos 44 px, foco visible y estados de error con texto, no solo color. Las animaciones respetan `prefers-reduced-motion`. La navegación cambia a menú desplegable por debajo de 960 px; el administrador usa un selector de vistas por debajo de 1040 px.

## Contratos de interacción

- `FormField` valida al salir del campo y durante la edición posterior. La validación final permanece en el formulario y en el servidor.
- `Dialog` y `useDialogA11y` administran Escape, foco inicial, confinamiento del foco y restauración al cerrar. El callback de cierre puede cambiar sin reiniciar el foco.
- `ActionMenu` admite flechas, Inicio/Fin y Escape. Se abre hacia arriba cuando el espacio inferior es insuficiente.
- Los avisos de `Toasts` pausan su cierre automático mientras reciben foco o el cursor está encima.
- La agenda consulta al servidor cuando cambia la fecha. Búsqueda y estado filtran localmente sin generar una petición por cada tecla. Exportar CSV utiliza el conjunto filtrado.
- La edición de servicios ocurre en un diálogo y se cierra únicamente cuando el controlador confirma que el guardado fue exitoso.
- `AdminDashboard` presenta tres indicadores y la agenda del día como una lista, sin tablas. `AppointmentActions` comparte las acciones entre el resumen y la agenda completa. «Atendido» y «No llegó» abren una confirmación; solo aceptarla invoca la API. La zona horaria de fechas y horas sigue siendo `America/Costa_Rica`.

## Verificación local

Desde `frontend`:

```powershell
npm test -- --maxWorkers=2
npm run build
npm run dev -- --host 127.0.0.1
```

`/qa/` está disponible solo en el servidor de desarrollo. Es una vista de prueba con datos sintéticos y sin conexión a la API para revisar el administrador. No representa un inicio de sesión ni se incluye como entrada del build de producción. Los cambios allí no persisten.

Revisar 320, 375, 768 y 1280 px: ausencia de desbordamiento horizontal, navegación móvil, selección de servicio, campos inválidos, apertura/cierre de diálogos, búsqueda de citas, menús junto al borde inferior y estados vacíos. Verificar también navegación con teclado y movimiento reducido.

Las pruebas automatizadas cubren reserva, validación, selección, búsquedas, edición de servicios, accesibilidad de diálogos y menús. No envían correos ni crean citas en producción.

## Despliegue

Este refactor no requiere migraciones ni nuevas variables de entorno. Vercel compila `frontend`; Render conserva el backend existente. Tras publicar, comprobar el estado del deployment de Vercel y comparar el SHA de `/health` en Render con el commit esperado. `/health/ready` verifica la conexión y las migraciones.
