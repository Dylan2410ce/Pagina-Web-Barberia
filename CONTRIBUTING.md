# Guía de contribución

## Principios

- Mantén separadas rutas, servicios, repositorios y modelos.
- La API es la autoridad para disponibilidad, permisos y reglas de negocio.
- Evita duplicar lógica de fechas o autenticación en React.
- No subas credenciales, `.env`, JSON de Google, dumps ni archivos generados.
- Documenta cambios de contrato, esquema o despliegue.

## Flujo recomendado

1. Crea una rama descriptiva desde `main`.
2. Lee la documentación y los módulos afectados antes de editar.
3. Mantén cada commit enfocado en una sola intención.
4. Actualiza pruebas cuando cambie el comportamiento.
5. Ejecuta pruebas, build y `git diff --check`.
6. Actualiza los `.md` correspondientes.
7. Abre el pull request con impacto, migraciones y variables nuevas.

## Convenciones del backend

- Python con funciones asíncronas para rutas y PostgreSQL.
- Validación de entrada con Pydantic.
- Reglas de negocio en services, no en handlers HTTP.
- Consultas reutilizables en repositories.
- Toda mutación administrativa respeta el `barber_id` del JWT.
- Las operaciones relevantes dejan auditoría cuando el dominio lo requiere.

## Convenciones del frontend

- Componentes funcionales y hooks de React.
- Cliente HTTP centralizado en `src/api/client.js`.
- Estados de carga, error y éxito explícitos.
- Controles accesibles y responsive desde 320 px.
- No mostrar secretos mediante variables `VITE_*`.

## Base de datos

- Cambios de esquema mediante Alembic.
- Índices para disponibilidad, propietario y fecha.
- Evita migraciones destructivas; documenta respaldo y recuperación si son
  inevitables.

## Checklist antes de merge

- [ ] El cambio tiene pruebas o una justificación clara.
- [ ] `npm test -- --run` pasa.
- [ ] `npm run build` pasa.
- [ ] `python -m pytest -q` pasa.
- [ ] `git diff --check` no reporta problemas.
- [ ] No hay secretos en archivos rastreados ni en el historial nuevo.
- [ ] Variables nuevas documentadas en `.env.example` y
      `docs/OPERATIONS.md`.
- [ ] Migraciones y rollback documentados si cambió el esquema.
- [ ] El README apunta a la documentación correcta.
