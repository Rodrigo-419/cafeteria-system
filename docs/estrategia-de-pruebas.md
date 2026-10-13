# Estrategia de pruebas

Estrategia de pruebas del backend, cómo se configuran, qué cubre cada suite y
cómo agregar pruebas a un módulo nuevo.

## 1. Estrategia

Dos niveles complementarios:

| Nivel | Qué prueba | Base de datos | Comandos |
| ----- | ---------- | ------------- | -------- |
| **Unitarias** | Lógica aislada: reglas de dominio y casos de uso (p. ej. política de contraseñas, permisos concedibles). | Ninguna (sin DB). | `npm test` |
| **End-to-end (e2e)** | La aplicación Nest real por HTTP (Supertest): prefijo `/api`, guards, `ValidationPipe`, casos de uso y base real. Reutiliza `configureApp`, el mismo código que `main.ts`. | Base PostgreSQL **aparte** (`*_test`). | `npm run test:e2e` |

Por qué dos niveles: las unitarias son rápidas y cubren reglas finas; las e2e
verifican el contrato HTTP completo y el comportamiento con una base real
(oom, transacciones, migraciones).

Las pruebas unitarias se escriben junto al código: `*.spec.ts` al lado de la
regla o caso de uso (p. ej. `password-policy.spec.ts`, `reglas-permisos.spec.ts`,
`dinero.spec.ts`, `estados-venta.spec.ts`, `alcance.spec.ts`). El `testRegex`
`.spec.ts$` de la configuración de Jest las descubre automáticamente.

## 2. Ejecución

```bash
cd backend
npm test            # unitarias
npm run test:e2e    # end-to-end (requiere la base de pruebas)
```

- **E2E corre en serie** (`--runInBand`): todas las suites comparten una única
  base de pruebas, así que no pueden correr en paralelo.
- La aplicación e2e **escucha en el puerto 0** (efímero): no ocupa un puerto fijo
  y las peticiones concurrentes se concentran en el mismo socket.
- Cada suite abre su propia instancia y la cierra en su `afterAll`.

## 3. Base de datos de pruebas

Nunca se toca la base de desarrollo. La mecánica:

1. `test/entorno-pruebas.ts` (cargado como `setupFiles`, antes de importar
   `AppModule`) fija `DATABASE_URL` con un nombre **derivado** de la de desarrollo
   y `JWT_SECRET`, y borra las variables del seed.
2. `test/setup-e2e.ts` (`globalSetup`) ejecuta `prisma migrate deploy` contra la
   base de pruebas.
3. `test/utils/url-base-pruebas.ts` aborta la ejecución si el nombre de la base no
   termina en `_test`, **antes** de conectarse o migrar.
4. `test/utils/reset-database.ts` vacía todas las tablas (`TRUNCATE ... CASCADE`)
   y re-ejecuta el seed entre suites: cada suite parte de los mismos datos base
   (3 sucursales, 3 roles, 24 permisos, 4 variantes y un administrador).

Base de pruebas: crea `cafeteria_test` (o el nombre derivado que termine en
`_test`) una sola vez:

```bash
docker exec cafeteria-db psql -U cafeteria -d cafeteria_db -c 'CREATE DATABASE cafeteria_test;'
```

Constantes del entorno (`test/utils/constantes-pruebas.ts`): nombre de usuario y
contraseña del administrador de pruebas, contraseñas válida/débil y el secreto JWT de
pruebas. El hash bcrypt usa 12 rondas reales (como producción), por lo que cada
alta de usuario cuesta algo de tiempo; es intencional.

> El **límite de intentos de login** (`LoginThrottleService`) se neutraliza por
> defecto en las pruebas (`test/utils/crear-app-pruebas.ts`, opción
> `neutroLoginThrottle`), para no interferir con decenas de logins. Las suites que
> prueban el comportamiento real (login y `trust-proxy`) lo reactivan con
> `neutroLoginThrottle: false` e inyectan un **reloj simulado** por el token
> `RELOJ_LOGIN`, de modo que avanzar la ventana de 1 minuto no implica esperas
> reales. El `ThrottlerGuard` global también usa almacenamiento sin límite en las
> pruebas.

## 4. Suites e2e

Cada módulo tiene su suite en `backend/test/`:

| Suite                 | Archivo                    | Cubre |
| --------------------- | -------------------------- | ----- |
| `app`                 | `app.e2e-spec.ts`          | Arranque, prefijo `/api`, pipes y controladores base. |
| `auth`                | `auth.e2e-spec.ts`         | Login, token, `me`, bloqueo, límite de intentos. |
| `branches`            | `branches.e2e-spec.ts`     | CRUD de sucursales, unicidad, alcance. |
| `products`            | `products.e2e-spec.ts`     | Catálogo, categorías, variantes, carta y precios por sucursal. |
| `inventory`           | `inventory.e2e-spec.ts`    | Insumos, stock, entradas, recuentos, movimientos y alertas. |
| `sales`               | `sales.e2e-spec.ts`        | Registrar, listar, obtener y anular ventas; validaciones y anulación. |
| `users`               | `users.e2e-spec.ts`        | Gestión de usuarios, estado, contraseñas y permisos individuales. |
| `equinpment`           | `equinpment.e2e-spec.ts`    | CRUD de equipos, cambio de estado e historial. |
| `employees`           | `employees.e2e-spec.ts`    | Vínculo con usuario, cargo, cese, PIN e inmutabilidad de justificaciones. |
| `shifts`              | `shifts.e2e-spec.ts`       | Turnos fijos/variables, asignaciones, solapamiento y retiro. |
| `attendance`          | `attendance.e2e-spec.ts`   | Marcación con PIN, doble marcaje, correcciones, cierre administrativo, justificación de faltas, lecturas y terminal. |
| `reports`             | `reports.e2e-spec.ts`      | Reporte comparativo entre sucursales: contrato, ventas, inventario, asistencia, estado actual, validaciones y autorización. |
| `trust proxy`         | `trust-proxy.e2e-spec.ts`  | `TRUST_PROXY`: con el valor por defecto `X-Forwarded-For` no evade el límite de login; activado, cada IP declarada tiene su propio límite. Usa el límite de login real (`crearAppConLimiteLoginReal`, sin neutralizar el throttle). |
| `login throttle`      | `login-throttle.e2e-spec.ts` | Solo cuentan los **fallos**: tras 5 fallos del mismo par usuario+IP (o 20 de la misma IP) responde `429` con `Retry-After` y mensaje, aunque llegue la contraseña correcta; el usuario inexistente cuenta igual; el bloqueo de una cuenta no afecta a otra; la ventana se reinicia al avanzar el **reloj simulado**. |

Helpers compartidos en `backend/test/utils/`:

- `http-pruebas.ts`: `iniciarSesion`, `tokenDeAdmin`, `como(token)`.
- `fixtures-pruebas.ts`: `idsDeSucursales`, `idDePermiso`, `crearUsuarioPorHttp`,
  `crearGerente`, `crearEmpleado`.
- `fixtures-productos-pruebas.ts`: datos base de productos.
- `reset-database.ts`: `resetDatabase`, `clientePrueba`, `cerrarClientePrueba`.

Los ids que usa una prueba (sucursales, permisos) se **leen de la base** cada vez,
porque el seed genera UUIDs v7 nuevas en cada reset.

Para e2e, el `moduleNameMapper` de `jest-e2e.json` remapea el `.js` del cliente
generado a su `.ts` (Node no lo resuelve solo).

## 5. Cobertura

Las cifras siguientes corresponden a la última ejecución limpia, verificada en
**2026-10-11** con `npm run build`, `npm run lint`, `npm test` y
`npm run test:e2e` (Docker con la base de pruebas disponible). Se refrescan
ejecutando los comandos de la sección 2.

| Nivel     | Suites | Casos |
| --------- | ------ | ----- |
| Unitarias | 58     | 806   |
| E2E       | 15     | 415   |

> La tabla no incluye un % de cobertura de código: el repo no define el comando
> `coverage` como parte del flujo estándar.

## 6. Agregar pruebas a un módulo nuevo

Patrón recomendado (coincide con lo que hacen las suites existentes):

1. **Unitarias** junto al código: `*.spec.ts` al lado de la regla o caso de uso
   (p. ej. `password-policy.spec.ts`, `reglas-permisos.spec.ts`). El patrón de
   Jest las descubre automáticamente (`testRegex .spec.ts$`).
2. **E2E** en `backend/test/<modulo>.e2e-spec.ts`:
   - `beforeAll`: `crearAppDePruebas()` (levanta la app con `configureApp`) y
     `resetDatabase(clientePrueba())`.
   - `afterAll`: cerrar la app y el cliente Prisma.
   - Usar los helpers HTTP y de fixtures, nunca abrir conexiones manuales.
3. Registrar la suite para que Jest la cargue: el `testRegex` de `jest-e2e.json`
   (`\.e2e-spec\.ts$`) la incluye automáticamente dentro de `backend/test/`.

Consideraciones:

- No fijar ids en el código: leerlos de la base (los UUIDs del seed cambian en
  cada reset).
- No abrir clientes de Prisma por prueba: usar `clientePrueba()` compartido.
- Para imports, el `moduleNameMapper` de `jest-e2e.json` remapea el `.js` del
  cliente generado a su `.ts` (Node no lo resuelve solo).

## 7. Integración continua

El flujo de GitHub Actions (`.github/workflows/ci.yml`) tiene **dos jobs que
corren en paralelo**:

- **backend**: `prisma generate`, `npm run build`, `npm run lint`, `npm test`
  (unitarias) y `npm run test:e2e`.
- **frontend**: desde `frontend/`, `npm ci`, `npm run lint`,
  `npm run build` (`tsc -b && vite build`, con comprobación de tipos) y
  `npm test` (vitest run), con caché de npm según `frontend/package-lock.json`.

El job de backend levanta un servicio **PostgreSQL 17** (misma major que
`docker-compose.yml`) con una base `cafeteria_test` y un usuario `cafeteria`,
espera a que el contenedor esté sano (`pg_isready`) y define el entorno con un
`JWT_SECRET` **ficticio** (nunca el real). Antes de las pruebas e2e se crea
`backend/.env` (gitignored) con la URL del servicio, porque el harness deriva de
ese archivo la conexión y le sustituye el nombre por `cafeteria_test`. El
`globalSetup` de e2e aplica `prisma migrate deploy` sobre la base de pruebas.

## 8. Frontend

### Alcance

- **Unitarias y componentes**: utilidades (`money`, `dates`, `permissions`,
  `session`), componente `<Can>`, `LoginPage`, `ProtectedRoute`,
  `RequirePermission` (guard por permiso), el menú por rol, `DataTable`,
  `ConfirmDialog`, las reglas del sistema de diseño, el módulo de ventas
  (`NewSalePage`, `SalesListPage`, `AnnulSaleDialog` y un flujo de rutas y
  permisos sobre `App`), el panel de control (`DashboardPage`) y el catálogo de
  productos y precios (`ProductsPage` y la carta por sucursal), y el inventario
  (`InsumosPage`, `InventarioPage`, `AlertasPage`, los recuentos
  `RecuentoNuevoPage`/`RecuentosPage` y los movimientos `MovimientosPage`).
- **Integración ligera con MSW**: se mockean `POST /api/auth/login`,
  `GET /api/auth/me`, la carta (`GET /api/branches/:id/products`), las
  sucursales (`GET /api/branches`), las ventas (`GET/POST /api/sales`,
  `GET /api/sales/:id`, `POST /api/sales/:id/anular`), el catálogo de productos
  (`GET/POST/PATCH/DELETE /api/products`), las categorías
  (`/api/product-categories`), las variantes (`/api/variants`), el upsert de
  precios (`PUT /api/branches/:sucursalId/products/:productoId/variants/:varianteId`),
  las alertas (`GET /api/inventario/alertas`), el stock y las entradas
  (`GET .../stock`, `PUT .../insumos/:insumoId`, `POST .../entradas`), los
  recuentos (`GET /api/inventario/recuentos`, `GET /api/inventario/recuentos/:id`,
  `POST /api/inventario/sucursales/:sucursalId/recuentos`), los movimientos
  (`GET /api/inventario/sucursales/:sucursalId/movimientos`), la asistencia
  (`GET /api/attendance/records`), los equipos (`GET /api/equipment`,
  `GET/POST /api/equipment`, `GET/PATCH /api/equipment/:id` y
  `GET /api/equipment/:id/history`) y el
  reporte comparativo (`GET /api/reports/comparativo`), incluidos los escenarios
  de error 400/403/404/409.

### Herramientas

- Vitest 5.0.3 (jsdom)
- Testing Library: `@testing-library/react`, `@testing-library/user-event`,
  `@testing-library/jest-dom`
- MSW 3.0.3 para interceptar peticiones HTTP en pruebas
- React Router DOM + TanStack Query en el entorno de test

### Ejecución

Desde `frontend/`:

```bash
npm test          # modo single-run (vitest run)
npm run test:watch
```

### Cobertura (estado actual)

- **Archivos de prueba**: 35
- **Total de tests**: **196 passed**

Detalle: `lib/api/errors.spec.ts`, `lib/auth/session.spec.ts`,
`lib/auth/AuthContext.test.tsx`, `lib/format/money.spec.ts`,
`lib/format/dates.spec.ts`,
`lib/permissions/permissions.spec.ts`, `lib/permissions/Can.test.tsx`,
`lib/permissions/RequirePermission.test.tsx`, `lib/navigation/menu.spec.ts`,
`features/auth/LoginPage.test.tsx`, `features/auth/cambio-de-cuenta.test.tsx`,
`routes/ProtectedRoute.test.tsx`,
`components/shared/DataTable.test.tsx`, `components/shared/ConfirmDialog.test.tsx`,
`design-rules.test.ts`, `theme-contrast.test.ts`, el módulo de ventas
(`features/sales/NewSalePage.test.tsx`, `features/sales/SalesListPage.test.tsx`,
`features/sales/AnnulSaleDialog.test.tsx` y `features/sales/SalesFlujo.test.tsx`), el
panel de control (`features/dashboard/DashboardPage.test.tsx`), el catálogo de
productos y la carta (`features/products/CatalogoProductos.test.tsx`,
`features/products/CartaPrecios.test.tsx`), el inventario
(`features/inventory/InsumosPage.test.tsx`,
`features/inventory/InventarioPage.test.tsx`,
`features/inventory/AlertasPage.test.tsx`,
`features/inventory/inventory.api.test.ts`,
`features/inventory/RecuentoNuevoPage.test.tsx`,
`features/inventory/RecuentosPage.test.tsx`,
`features/inventory/MovimientosPage.test.tsx`), la regresión del inventario
(`features/inventory/regresion.test.tsx`), los equipos
(`features/equipment/EquiposPage.test.tsx`,
`features/equipment/EquipoDetallePage.test.tsx`,
`features/equipment/equipment.api.test.ts`) y el landing autenticado
(`features/auth/landing.test.tsx`).

### Nada de `setState` tras desmontar (regla)

Ningún efecto debe actualizar estado después de que el componente se haya
desmontado. Los efectos que dependen de una **petición asíncrona** (por ejemplo la
validación de la sesión guardada con `GET /auth/me` en
`lib/auth/AuthContext.tsx`) **deben cancelarse en la limpieza del efecto**:
`AbortController` sobre la petición y una **bandera de cancelación** que ignore
respuestas tardías. `iniciarSesion` también comprueba una bandera de montaje antes
de tocar el estado.

**Causa exacta** (corregida): la promesa de `GET /auth/me` no se cancelaba al
desmontar y su `.then`/`.finally` hacían `setSesion`/`setCargando` después del
desmontaje. Al terminar el archivo de prueba, Vitest destruía el entorno jsdom
mientras el worker seguía vivo (pool de workers reutilizados); la respuesta tardía
hacía que React leyera `window` y lanzara `ReferenceError: window is not defined`
(`resolveUpdatePriority` → `dispatchSetState` → `AuthContext.tsx`), una
*Unhandled Rejection* que provocaba `exit code 1` en el job de frontend aunque los
tests aparecieran en verde. Era una carrera dependiente de tiempos (se reproducía
con `--pool=threads`, no siempre con el pool por defecto). Regresión cubierta por
`lib/auth/AuthContext.test.tsx`: monta el proveedor con sesión guardada, captura el
`AbortSignal` de la petición, desmonta antes de que responda y comprueba que el
signal queda abortado y que una respuesta tardía no rompe nada. Además, cada prueba
espera a que se asiente la carga inicial de la sesión (`findBy`/`waitFor`) antes de
terminar, y `test/setup.ts` ejecuta `server.resetHandlers()` en `afterEach` y
`server.close()` en `afterAll`.

Casos de ventas cubiertos: registrar y mostrar la confirmación del servidor,
doble clic sin segunda petición, carrito vacío deshabilita el botón, oferta
inactiva (409), falta de `productos.ver` sin cargar la carta, Empleado sin
`ventas.ver` que no llama al listado, Admin sin acciones de registrar/anular,
detalle de venta completada y anulada, anular con motivo vacío, 403 al anular
venta ajena, 409 al anular de otro día, filtro de sucursal solo para Admin y
filtro de estado que viaja como parámetro a la API.

Casos del panel cubiertos: Admin ve todos los bloques; el Gerente no ve el
reporte comparativo y su ruta `GET /reports/comparativo` no se llama; un Empleado
con permisos mínimos ve solo su bloque y no se llama a las rutas de los demás; y
el error de un bloque (500) no rompe los otros bloques. Las listas de permisos
por rol usadas en estas pruebas (`PERMISOS_ADMIN`/`PERMISOS_GERENTE`/
`PERMISOS_EMPLEADO` en `src/test/handlers.ts`) reflejan la matriz real de
`docs/seguridad-y-permisos.md`.

Casos de productos cubiertos: crear un producto (201) y verlo en el catálogo,
nombre duplicado (409), borrado bloqueado por dependencias (409), estados vacío
y de error del listado; el Gerente fija un precio válido, un precio fuera de
rango devuelve el 400 del servidor, una sucursal fuera de alcance devuelve 404;
el Admin (sin `productos.precio.editar`) y el Empleado solo consultan la carta,
sin acciones de edición (y el Empleado no ve el filtro de estado).

Casos de inventario cubiertos (pantallas): crear un insumo (201) y verlo en el
catálogo, nombre duplicado (409), borrado bloqueado por stock (409), estados
vacío y de error; en `InventarioPage`, el Admin debe elegir sucursal y luego ve
KPIs y tabla, registrar una entrada actualiza el stock en pantalla, dar de alta
un insumo en una sucursal vacía (upsert), el usuario sin permisos de edición no
ve las acciones y el estado de error; en `AlertasPage`, el listado con el banner
de "alertas automáticas" y **sin** botón "Resolver", la columna de sucursal solo
para el Admin, y los estados vacío y de error. `inventory.api.test.ts` verifica
los contratos directos: 201 de insumo, 409 duplicado, 400 de presentación
inválida, 409 de borrado con stock, 400 de entrada con cantidad 0, 409 de
entrada a insumo descontinuado, 404 de entrada a insumo no dado de alta, 404 de
sucursal fuera de alcance (Gerente) y 201 de entrada válida.

Casos de recuentos y movimientos cubiertos: en `RecuentoNuevoPage` solo se envían
las líneas con valor contado (el resumen del `ConfirmDialog` no dispara petición
hasta confirmar) y el conteo `0` se acepta mostrando una diferencia negativa; un
físico negativo bloquea "Revisar recuento" con el mensaje de validación y un
recuento fuera de alcance devuelve 404. En `RecuentosPage`, el detalle muestra
usuario, sucursal y la diferencia ("-1" / "Disminución"), el Admin ve la columna
Sucursal y un usuario sin `inventario.recuento` no ve acciones (estado vacío). En
`MovimientosPage`, la lista muestra la variación firmada (+5 / -1) y el tipo
(Entrada/Ajuste), el filtro por tipo viaja a la API, el Admin debe elegir sucursal
y un error del servidor (500) muestra el estado de error. El `POST` de recuento no
es idempotente en el servidor (limitación conocida de la Fase 1): un doble envío
crearía dos recuentos, lo que se mitiga en el frontend deshabilitando el botón de
confirmar (y el de cancelar) mientras la petición está en curso gracias al
`loading` del `ConfirmDialog`.

Casos de equipos cubiertos: el Admin ve la columna y el filtro de sucursal y
equipos de todas las sucursales, mientras que el Gerente solo ve las suyas y
sin columna/filtro de sucursal; el Admin registra eligiendo sucursal y el
Gerente registra en la suya sin selector; la búsqueda filtra por nombre o tipo;
un equipo retirado no ofrece "Cambiar estado" (pero sí "Editar"); un usuario
con solo `equipo.ver` ve el listado y "Ver detalle" sin acciones de edición; y
los estados vacío, de error y de carga del listado. En `EquipoDetallePage`, se
muestran los datos y el historial, un cambio de estado + observaciones agrega una
entrada a la línea de tiempo, un equipo retirado no ofrece "Cambiar estado" pero
sí "Editar", un usuario sin permiso de edición no ve acciones, y un equipo fuera
de alcance (Gerente → 404) muestra el error. `equipment.api.test.ts` verifica los
contratos directos: 201 de creación en `funcionando`, el Gerente forzado a su
sucursal aunque envíe otra, el Admin creando en la sucursal elegida, 400 de
nombre corto, 409 al cambiar el estado de un equipo retirado, 404 al consultar
fuera de alcance y el historial ordenado del más reciente al más antiguo.

Casos de usuarios y permisos cubiertos: el Admin ve la columna y el filtro de
sucursal y usuarios de todas las sucursales, mientras que el Gerente solo ve los
Empleados de su sucursal y sin columna/filtro de sucursal; la búsqueda filtra por
nombre o nombre de usuario; el Admin crea un Empleado eligiendo sucursal y el
Gerente crea en su sucursal sin selectores de rol ni sucursal; crear un Gerente
exige elegir sucursal y un Admin no lleva sucursal (el selector queda
deshabilitado); el 409 de nombre de usuario repetido muestra el mensaje del
servidor; una contraseña corta deshabilita el alta; "Generar contraseña" produce
una de 20 caracteres que **no se persiste** (ni en `sessionStorage`/`localStorage`
ni en las claves del caché de consultas); la propia fila solo ofrece "Editar"
(sin Permisos ni Bloquear); el Admin edita rol y sucursal de un Empleado; bloquear
un Empleado confirma y cambia el estado en la tabla; y los estados vacío, de
error y de carga del listado. En `PermisosUsuarioDialog`, un permiso revocado de
un Empleado aparece como Inactivo con "Conceder" deshabilitado (regla de los 4
concedibles), conceder de nuevo a un Gerente pasa la fila a "Quitar" y quitarla
vuelve al valor del rol, revocar un permiso del rol pasa a "Conceder", y no se
puede revocar un permiso que el actor no posee. `users.api.test.ts` verifica los
contratos directos: alcance del Gerente, forzado de rol/sucursal al crear, 400 de
contraseña corta y de más de 72 bytes, 409 de `nombreUsuario` duplicado, 403 del
Gerente al cambiar rol, 404 fuera de alcance, 400 al cambiar el estado de la
propia cuenta, 409 del último Admin activo (dos llamadas seguidas), las
revocaciones sembradas, revocar/conceder/quitar y los 400 de la matriz de
permisos (conceder a un Empleado uno fuera de los 4, revocar uno que el rol no da
por defecto y asignar uno que el actor no posee). El generador de contraseñas se
prueba de forma aislada en `generador-password.test.ts` (≥16 caracteres,
alfabeto seguro y valores distintos).

### Detalles relevantes

- `renderConProveedores` envuelve con `QueryClientProvider`, `MemoryRouter` y
  `ProveedorAutenticacion`.
- `iniciarSesionDePrueba(usuario, token?)` guarda una sesión válida y fuerza
  `GET /auth/me` a devolver ese usuario (evita efectos no deterministas del
  refresco al arranque).
- `setup.ts`: `server.listen({ onUnhandledFrame: 'error' })` y limpieza de
  handlers/storage/URL tras cada test. Incluye polyfills de jsdom para
  `window.matchMedia` (lo exige `sonner`), `hasPointerCapture`/
  `setPointerCapture`/`releasePointerCapture` y `scrollIntoView` (los exige
  Radix Select al abrir y desplazar el menú).
- El **catálogo de productos** mockeado es estado mutable (fixtures
  `CATEGORIAS_PRUEBA`/`VARIANTES_PRUEBA`/`PRODUCTOS_PRUEBA` en
  `src/test/handlers.ts`); `reiniciarCatalogoPrueba()` lo restaura tras cada test
  y los handlers replican las reglas del backend (unicidad 409, borrado con
  dependencias 409, precio fuera de rango 400).
- El **inventario** mockeado también es estado mutable (stock, movimientos y
  recuentos en `src/test/handlers.ts`); `reiniciarInventarioPrueba()` lo restaura
  tras cada test y los handlers replican las reglas del backend (validación de
  cantidades 400, sucursal/insumo fuera de alcance 404, solicitud sin líneas 400,
  y el alta de un recuento fija el stock y genera un ajuste solo si hay
  diferencia).
- Los **equipos** mockeados son estado mutable (equipos e historial en
  `src/test/handlers.ts`); `reiniciarEquiposPrueba()` los restaura tras cada test
  y el alcance se acota por el actor de la sesión (`establecerActorEquipos`,
  fijado por `iniciarSesionDePrueba`; sin sesión no aplica alcance). Los handlers
  replican las reglas del backend: el Gerente crea siempre en su sucursal (aunque
  envíe otra), un equipo retirado devuelve 409 al intentar cambiar su estado, una
  sucursal ajena responde 404 y cada cambio de estado u observaciones agrega una
  entrada al historial con el usuario de la sesión.
- Los **usuarios** mockeados también son estado mutable (fixtures
  `USUARIOS_PRUEBA` y un mapa de asignaciones individuales por
  `usuarioId:permisoId` en `src/test/handlers.ts`); `reiniciarUsuariosPrueba()`
  los restaura tras cada test y el alcance se acota por el actor de la sesión
  (`establecerActorUsuarios`, fijado por `iniciarSesionDePrueba`; sin sesión no
  aplica alcance). Se siembran dos revocaciones realistas (`inventario.recuento`
  revocado a un Gerente y `productos.ver` revocado a un Empleado) para probar
  conceder/revocar/restaurar. Los handlers replican las reglas del backend: el
  Gerente solo ve y crea Empleados de su sucursal (404 fuera de alcance), el
  rol/sucursal solo los cambia el Admin (403), la propia cuenta responde 400, el
  último Admin activo responde 409, `nombreUsuario` duplicado responde 409 y las
  reglas de permisos (`PUT`/`DELETE`) replican poseer el permiso, la matriz de los
  4 concedibles a un Empleado y revocar solo lo que el rol da por defecto.
- El **menú por rol** se prueba con los permisos reales de Admin/Gerente/Empleado
  (tomados del seed del backend) y con un caso de permiso revocado.
- El **panel de control** se prueba sobre `DashboardPage` con los permisos
  reales de cada rol; el bloque del reporte comparativo no debe montar su
  consulta cuando falta el permiso (se afirma que la ruta no se llamó), y el
  fallo aislado de un bloque no debe romper los demás.
- El **login** tiene ahora un botón para mostrar/ocultar la contraseña: las
  pruebas localizan el campo con
  `getByLabelText(/contraseña/i, { selector: 'input' })` para no confundirlo con
  el `aria-label` del botón, y el botón de envío por nombre (`/ingresar/i`, o
  `/ingresando/i` mientras la petición está en curso).
- `design-rules.test.ts` usa `import.meta.glob` para verificar: una sola hoja CSS
  global (`index.css`), ausencia de `style={{}}` y ausencia de colores hex/rgb
  crudos fuera de `components/ui`.
