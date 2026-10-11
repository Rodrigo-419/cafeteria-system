# Visión general de la arquitectura

Descripción de cómo está organizado el backend de Cafeteria System, qué tecnología
usa, cómo se relacionan los módulos y qué ocurre en una petición autenticada.

## 1. Qué es el backend

El backend es una **API REST** construida como un **monolito modular** con NestJS.
Gestiona la operación de una cadena de cafeterías con varias sucursales: usuarios
y permisos, sucursales, catálogo de productos con precios por sucursal, inventario
con alertas y recuentos, ventas con anulación, equipos por sucursal, personal
(empleados, turnos, asignaciones y asistencia) y reportes comparativos entre
sucursales. Todos los módulos están implementados y registrados en `AppModule`.

Características centrales:

- Todo el tráfico pasa por el prefijo global `/api` (`APP_GLOBAL_PREFIX` en
  `backend/src/config/app.config.ts`).
- Toda ruta requiere autenticación con JWT salvo las marcadas como públicas
  (`@Public()`; por ahora solo `POST /api/auth/login`).
- Las rutas protegidas exigen, además, permisos declarados con
  `@RequirePermission(...)`.
- La configuración se valida al arrancar con Zod (`backend/src/config/env.config.ts`).
- Las pruebas end-to-end reutilizan la misma configuración de la instancia real a
  través de `configureApp` (`backend/src/app.setup.ts`).

## 2. ¿Por qué monolito modular?

Se eligió un **monolito modular** en lugar de microservicios:

- Todo el equipo entrega en un solo despliegue y una sola base de datos, sin la
  complejidad operativa de los microservicios (red, versionado independiente,
  integridad distribuida).
- Los **módulos** (`backend/src/modules/*`) son la frontera de responsabilidad: cada
  uno agrupa su lógica de negocio y no se importa desde otros módulos salvo por
  piezas explícitas y compartidas (p. ej. las reglas de roles en `users/domain`).
- Las **transacciones multi-módulo** no existen: cada caso de uso opera sobre su
  propio agregado y toda escritura se hace en una transacción local (Prisma), lo
  que preserva la consistencia sin servicio de mensajería.
- El día que algún módulo necesite escalar o desplegarse aparte (p. ej. ventas),
  la frontera ya está marcada y el movimiento natural es extraer ese módulo tal
  cual, porque no depende de clases internas de los demás.

## 3. Stack tecnológico

| Capa            | Tecnología                                                          |
| --------------- | ------------------------------------------------------------------- |
| Framework       | NestJS (módulos, DI, guards, pipes y Swagger por decoradores).      |
| Validación      | `class-validator` + `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`). |
| Configuración   | `@nestjs/config` + esquema Zod.                                     |
| ORM             | Prisma (cliente generado en `backend/src/generated/prisma`), con driver `pg`. |
| Base de datos   | PostgreSQL 17 (contenedor en `docker-compose.yml`).                 |
| Autenticación   | `@nestjs/jwt`, estrategia que recalcula permisos en cada petición.  |
| Limitación de tráfico | `@nestjs/throttler`.                                           |
| Lenguaje        | TypeScript con compilación de Nest (`npm run build`).               |
| Lint            | oxlint (`npm run lint`).                                            |
| CI              | GitHub Actions (ver `.github/workflows/ci.yml`).                    |

## 4. Organización en capas

Los módulos con lógica real (auth, users, branches, products, inventory, sales,
equipment, employees, shifts, attendance, reports) implementan las **capas
completas**:

- **presentation**: controllers HTTP, DTOs y guards específicos del módulo.
- **application**: casos de uso que orquestan la operación (y, cuando hace falta,
  la transacción).
- **domain**: reglas puras del negocio (alcance por rol/sucursal, invariantes de
  cantidad, dinero, estados). Son funciones sin dependencias de Nest ni Prisma.
- **infrastructure**: adaptadores externos (estrategia JWT, repositorios Prisma).

Todos los módulos usan esta estructura; ya no queda ninguno con la organización
liviana de esqueleto.

Elementos comunes en `backend/src/common/`: decoradores `Public`,
`RequirePermission`, `User` y el manejo global de excepciones.

```mermaid
flowchart LR
    REQ["Petición HTTP /api/..."] --> JWT["JwtAuthGuard (global)"]
    JWT --> PERM["PermissionsGuard (global)"]
    PERM --> THROTTLE["ThrottlerGuard (global)"]
    THROTTLE --> PIPE["ValidationPipe + DTO"]
    PIPE --> CTRL["Controller (presentation)"]
    CTRL --> UC["Caso de uso (application)"]
    UC --> RULES["Reglas de dominio (domain)"]
    UC --> REPO["Repositorio / Prisma (infrastructure)"]
    REPO --> DB[("PostgreSQL 17")]
```

Los tres guards se registran como `APP_GUARD` en `AppModule`, en ese orden
(JWT → permisos → throttling).

## 5. Módulos

Todo el código está en `backend/src/modules/`. Estado real de cada paquete:

| Módulo      | Estado      | Superficie HTTP                                          |
| ----------- | ----------- | -------------------------------------------------------- |
| `auth`      | Implementado | `POST /api/auth/login`, `GET /api/auth/me`.              |
| `users`     | Implementado | CRUD de usuarios, estado, contraseñas y permisos individuales. |
| `branches`  | Implementado | CRUD (sin borrado) de sucursales.                        |
| `products`  | Implementado | Catálogo, categorías, variantes y carta/precios por sucursal. |
| `inventory` | Implementado | Insumos, stock, entradas, recuentos, movimientos y alertas. |
| `sales`     | Implementado | Registro, listado, detalle y anulación de ventas.        |
| `equipment` | Implementado | CRUD (sin borrado) de equipos y su historial.            |
| `employees` | Implementado | Empleados vinculados a usuario, cargo, cese y PIN.       |
| `shifts`    | Implementado | Turnos fijos/variables y asignaciones.                   |
| `attendance`| Implementado | Marcación con PIN, correcciones, faltas y lecturas.      |
| `reports`   | Implementado | `GET /api/reports/comparativo` (comparativo entre sucursales). |

El módulo de reportes quedó **implementado** y registrado en `AppModule`: expone
`GET /api/reports/comparativo` bajo el permiso `reportes.comparativos.ver`. No
tiene esqueleto pendiente (sus archivos base se eliminaron). El seed ya cubría su
permiso (ver [Modelo de datos](../modelo-de-datos.md)).

## 6. Ciclo de una petición autenticada

Con los guards globales y la validación global:

```mermaid
sequenceDiagram
    participant C as Cliente
    participant J as JwtAuthGuard
    participant P as PermissionsGuard
    participant V as ValidationPipe
    participant CO as Controller
    participant U as Caso de uso
    participant R as Repositorio (Prisma)
    participant D as PostgreSQL

    C->>J: GET /api/products (Authorization: Bearer <token>)
    J->>J: Verifica firma y vigencia del JWT
    J->>J: Carga el usuario y recalcula sus permisos efectivos desde BD
    J->>P: request.user autenticado
    P->>P: Lee @RequirePermission de la ruta (si lo hay)
    alt Sin permiso requerido y autenticado, o con el permiso
        P->>V: Valida query/body contra el DTO
        V->>CO: Invoca el handler
        CO->>U: Ejecuta el caso de uso
        U->>R: Consulta acotada al alcance (rol/sucursal)
        R->>D: SELECT / transacción
        D-->>R: Resultado
        R-->>U: Datos
        U-->>CO: Respuesta de dominio
        CO-->>C: JSON (200 / 201 / 204)
    else Permiso insuficiente o token ausente
        P-->>C: 401 / 403
    end
```

Detalles importantes del flujo:

- **El permiso se recalcula en cada petición**: la estrategia JWT vuelve a la base
  de datos para calcular `permisosEfectivos` (permisos del rol + permisos
  individuales del usuario, − revocados). Cambiar un rol o revocar un permiso
  surte efecto inmediatamente, sin esperar a que expire el token.
- **Alcance por sucursal**: no depende del guard, sino de las reglas del caso de
  uso. Por ejemplo, un Gerente solo opera con datos de su propia sucursal y una
  sucursal ajena se responde `404`, no `403` (para no filtrar existencia).
- **El `ValidationPipe` rechaza propiedades desconocidas**
  (`forbidNonWhitelisted`): el cuerpo y los query de la petición solo pueden traer
  lo que el DTO declara.

## 7. Arranque y configuración

Flujo de arranque de `backend/src/main.ts`:

1. `NestFactory.create(AppModule)`.
2. `configureApp(app)`: prefijo `/api` + `ValidationPipe` (el mismo código usan
   las pruebas e2e).
3. `enableShutdownHooks()` para cerrar el pool de Prisma ante SIGINT/SIGTERM.
4. Swagger en `/api/docs` si `NODE_ENV !== 'production'`.
5. Escucha en `app.port` (defecto 3000, configurable con `PORT`).

Variables de entorno validadas (defectos entre paréntesis): `DATABASE_URL`
(obligatoria), `PORT` (3000), `NODE_ENV` (development), `JWT_SECRET` (obligatorio,
mínimo 32), `JWT_EXPIRES_IN` (8h). Ver `backend/src/config/env.config.ts`.

## 8. Frontend

El directorio `frontend/` aún no tiene implementación (solo el esqueleto del
monorepo). No existe aplicación cliente que consuma la API en estos momentos; la
referencia de contrato es la [API](../referencia-api.md) y los documentos de
diseño en `docs/architecture/`.