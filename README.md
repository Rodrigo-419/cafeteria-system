# Cafeteria System

Sistema de gestión para una cadena de cafeterías con múltiples sucursales.
Permite centralizar ventas, inventario, personal y asistencia de cada sede.
Monorepo con backend NestJS, frontend y documentación técnica.

## Estructura del repositorio

| Ruta                | Contenido                                                      |
| ------------------- | -------------------------------------------------------------- |
| `backend/`          | API REST con NestJS, Prisma y PostgreSQL (módulos y pruebas).  |
| `frontend/`         | Aplicación cliente (por implementar; solo esqueleto del monorepo). |
| `docs/`             | Documentación técnica del sistema.                             |
| `docker-compose.yml`| Base de datos PostgreSQL para desarrollo.                      |

## Requisitos

- Node.js 24 y npm (el proyecto declara `engines` en `backend/package.json`).
- PostgreSQL 17 (o el contenedor de `docker-compose.yml`).

## Documentación

El índice completo de la documentación técnica está en [docs/README.md](docs/README.md).
Incluye la guía de inicio, la visión general de la arquitectura, la seguridad y
permisos, el modelo de datos, la referencia de la API, las decisiones de diseño
y la estrategia de pruebas.

Documentos destacados:

- [Guía de inicio](docs/guia-de-inicio.md)
- [Visión general de la arquitectura](docs/architecture/vision-general.md)
- [Seguridad y permisos](docs/seguridad-y-permisos.md)
- [Modelo de datos](docs/modelo-de-datos.md)
- [Referencia de la API](docs/referencia-api.md)
- [Decisiones de diseño](docs/architecture/decisiones-de-diseno.md)
- [Estrategia de pruebas](docs/estrategia-de-pruebas.md)

## Estado por módulo

| Módulo       | Estado      | Descripción |
| ------------ | ----------- | ----------- |
| `auth`       | Implementado | Login JWT (8 h), límite de 5 intentos/min/IP y perfil propio. |
| `users`      | Implementado | Usuarios, roles, alcance por sucursal y permisos individuales con historial. |
| `branches`   | Implementado | Sucursales: crear, editar y consultar con visibilidad por rol. |
| `products`   | Implementado | Catálogo global (categorías, variantes, productos) y precios por sucursal. |
| `inventory`  | Implementado | Insumos, stock, entradas, recuentos, movimientos y alertas automáticas. |
| `sales`      | Implementado | Registro (precios congelados), consulta y anulación del mismo día. |
| `equipment`  | Implementado | Equipos por sucursal con historial de estado y observaciones. |
| `employees`  | Implementado | Empleados vinculados a un usuario, cargo, cese y PIN de marcación. |
| `shifts`     | Implementado | Turnos fijos/variables y asignaciones con control de solapamiento. |
| `attendance` | Implementado | Registro de asistencia (marcas inmutables), correcciones, justificaciones y faltas. |
| `reports`    | Implementado | Reporte comparativo entre sucursales (ventas, inventario y asistencia). |

Todos los módulos del backend están implementados. Ver
[Decisiones de diseño](docs/architecture/decisiones-de-diseno.md) para las reglas
de negocio y [Referencia de la API](docs/referencia-api.md) para las rutas.

## Puesta en marcha

La guía paso a paso (base de datos, variables de entorno, migraciones, seed y
servidor de desarrollo) está en [docs/guia-de-inicio.md](docs/guia-de-inicio.md).

## API

- Base de la API: `http://localhost:3000/api` (el prefijo `/api` lo define
  `backend/src/app.setup.ts`).
- Documentación interactiva (Swagger): `http://localhost:3000/api/docs` cuando el
  entorno de ejecución no es `production`.
- Autenticación: `POST /api/auth/login` devuelve un token JWT que debe enviarse en
  la cabecera `Authorization: Bearer <token>`.

## Pruebas

La estrategia, las cifras actuales y el detalle de las suites están en
[docs/estrategia-de-pruebas.md](docs/estrategia-de-pruebas.md).

GitHub Actions (`.github/workflows/ci.yml`) ejecuta en cada push/PR a `main` el
build, el lint, las pruebas unitarias y las e2e contra un servicio PostgreSQL 17.

### Unitarias

Prueban lógica aislada: casos de uso y reglas de dominio, sin base de datos.

```bash
cd backend
npm test
```

### E2E

Levantan la aplicación Nest real contra una base de datos **aparte** y la ejercitan por HTTP con Supertest. Reutilizan el mismo `configureApp` que `main.ts`, de modo que el prefijo global y el `ValidationPipe` se prueban tal y como están en producción.

```bash
cd backend
npm run test:e2e
```

La configuración vive en `backend/test/jest-e2e.json` y:

- corre en serie (`--runInBand`) porque las pruebas comparten una única base de datos;
- fija `DATABASE_URL` y el secreto JWT en `backend/test/entorno-pruebas.ts` como `setupFiles`, antes de que se importe `AppModule`, porque `ConfigModule.forRoot()` lee el entorno en el momento de la importación;
- redirige los imports del cliente Prisma generado a su `.ts`, ya que Node no resuelve el `.js` que aparece en el código generado.

#### Base de datos de pruebas

Las pruebas nunca tocan la base de desarrollo. El nombre se deriva de `DATABASE_URL` y debe terminar en `_test`; si no, la ejecución se aborta antes de migrar o borrar nada.

```bash
docker exec cafeteria-db psql -U cafeteria -d cafeteria_db -c 'CREATE DATABASE cafeteria_test;'
```

Ese es el único paso manual: la URL completa se calcula a partir de `backend/.env` sin imprimirla, `prisma migrate deploy` aplica las migraciones y cada prueba empieza truncando las tablas y volviendo a sembrar los datos mínimos (3 sucursales, 3 roles, permisos y un administrador).

El resto del entorno de pruebas (secreto JWT, credenciales del administrador y puertos) está en `backend/test/utils/constantes-pruebas.ts`.