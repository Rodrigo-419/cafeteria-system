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
docker exec cafeteria-db psql -U postgres -c 'CREATE DATABASE cafeteria_test;'
```

Constantes del entorno (`test/utils/constantes-pruebas.ts`): correo y contraseña
del administrador de pruebas, contraseñas válida/débil y el secreto JWT de
pruebas. El hash bcrypt usa 12 rondas reales (como producción), por lo que cada
alta de usuario cuesta algo de tiempo; es intencional.

> El almacenamiento del throttler se sustituye en las pruebas
> (`test/utils/crear-app-pruebas.ts`): el guard global se mantiene, pero el
> almacenamiento nunca bloquea, para no interferir con decenas de logins.

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
| `equipment`           | `equipment.e2e-spec.ts`    | CRUD de equipos, cambio de estado e historial. |
| `employees`           | `employees.e2e-spec.ts`    | Vínculo con usuario, cargo, cese, PIN e inmutabilidad de justificaciones. |
| `shifts`              | `shifts.e2e-spec.ts`       | Turnos fijos/variables, asignaciones, solapamiento y retiro. |
| `attendance`          | `attendance.e2e-spec.ts`   | Marcación con PIN, doble marcaje, correcciones, cierre administrativo, justificación de faltas, lecturas y terminal. |
| `reports`             | `reports.e2e-spec.ts`      | Reporte comparativo entre sucursales: contrato, ventas, inventario, asistencia, estado actual, validaciones y autorización. |

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
**2026-10-10** con `npm run build`, `npm run lint`, `npm test` y
`npm run test:e2e` (Docker con la base de pruebas disponible). Se refrescan
ejecutando los comandos de la sección 2.

| Nivel     | Suites | Casos |
| --------- | ------ | ----- |
| Unitarias | 53     | 757   |
| E2E       | 12     | 396   |

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

El flujo de GitHub Actions (`backend/.github/workflows/ci.yml`) valida en cada
push/PR a `main`: `npm ci`, `prisma generate` (con una URL ficticia), `npm run
build`, `npm run lint` y `npm test`.

**El job e2e no está en CI** (limitación conocida): para validar el contrato
completo hay que ejecutar `npm run test:e2e` en local con la base de pruebas
disponible.