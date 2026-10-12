# Guía de inicio

Cómo levantar el backend en desarrollo: base de datos, variables de entorno,
migraciones, seed y servidor.

## Requisitos

- **Node.js 24** y npm (el backend declara `engines` en `backend/package.json`).
- **PostgreSQL 17**. La vía más simple es el contenedor de `docker-compose.yml`.
- Docker opcional para la base de datos; el backend no necesita contenedor.

## 1. Base de datos

En la raíz del repositorio hay un `docker-compose.yml` que levanta PostgreSQL 17
(puerto y credenciales configurables):

```bash
docker compose up -d
```

El servicio se llama `db` y crea el contenedor `cafeteria-db`. La configuración
del contenedor se lee de las variables `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`POSTGRES_DB` y `POSTGRES_PORT`.

> El `.env` de la raíz contiene las credenciales de Docker y **no está versionado**
> (ver `.gitignore`). La plantilla pública está en `.env.example`.

Puedes comprobar que la base responde con:

```bash
docker exec cafeteria-db pg_isready -U cafeteria -d cafeteria_db
```

## 2. Variables de entorno del backend

Copia la plantilla del backend y complétala con tus valores:

```powershell
# Windows (PowerShell)
cd backend
Copy-Item .env.example .env

# Linux / macOS
cd backend
cp .env.example .env
```

El archivo `backend/.env` define, como mínimo:

| Variable              | Descripción                                                |
| --------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`        | Cadena de conexión a PostgreSQL (defecto: localhost:5432).  |
| `SEED_ADMIN_USUARIO`  | Nombre de usuario del administrador inicial.                |
| `SEED_ADMIN_PASSWORD` | Contraseña del administrador (mínimo 12 caracteres).        |
| `SEED_DEMO_PASSWORD`  | Contraseña de los usuarios demo (mínimo 12; solo desarrollo).|
| `JWT_SECRET`          | Secreto para firmar tokens (mínimo 32 caracteres).          |
| `JWT_EXPIRES_IN`      | Vigencia del token; el valor por defecto es `8h`.           |
| `TRUST_PROXY`         | Confianza en `X-Forwarded-For`; desactivado por defecto.    |
| `CORS_ORIGIN`         | Orígenes permitidos (lista por comas); vacío por defecto.   |

> El `.env` del backend **no está versionado** (ver `backend/.gitignore`). Nunca
> se suben secretos al repositorio.

`TRUST_PROXY` controla si la IP del cliente para el límite de intentos de login
se toma de la cabecera `X-Forwarded-For`. Por defecto vale `false`: **solo debe
activarse cuando la aplicación está detrás de un proxy inverso propio** (por
ejemplo con `TRUST_PROXY=true`, un número de saltos o una lista de subredes como
`loopback`). Activarlo sin proxy permite falsear la IP y esquivar el límite.

El login solo penaliza los **fallos**: con 5 fallos del mismo par usuario + IP (o
20 fallos de la misma IP) responde `429` con `Retry-After` durante la ventana de
1 minuto. Los contadores viven en memoria, así que se reinician al reiniciar el
servidor; el resto de la API usa un límite global de 300 peticiones/minuto por IP.

`CORS_ORIGIN` es la lista de orígenes autorizados a consumir la API desde un
navegador, separados por comas (por ejemplo
`CORS_ORIGIN=http://localhost:5173,http://localhost:4173`). Por defecto está
**vacía y no se permite ningún origen**; como la autenticación viaja en la
cabecera `Authorization` (Bearer), no se habilitan credenciales de CORS. El
frontend de desarrollo usa el proxy de Vite hacia `http://localhost:3000`, de
modo que en desarrollo no hace falta definirla.

Para generar un secreto seguro, la plantilla sugiere algo como:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Estas variables se validan en tiempo de arranque con un esquema Zod en
`backend/src/config/env.config.ts`. Si alguna falta o no cumple el mínimo, la
aplicación no arranca e informa del error **sin imprimir valores**.

## 3. Instalar dependencias

```bash
cd backend
npm install
```

## 4. Aplicar migraciones y sembrar datos

El esquema de Prisma vive en `backend/prisma/schema.prisma`. Las migraciones se
aplican contra la base indicada por `DATABASE_URL`:

```bash
npx prisma migrate deploy
```

El seed crea los datos base (3 roles, 24 permisos, 3 sucursales, las variantes y
el usuario administrador). Es idempotente: puede ejecutarse varias veces sin
duplicar datos.

```bash
npm run db:seed
```

El administrador se crea con el nombre de usuario y la contraseña de `SEED_ADMIN_USUARIO` y
`SEED_ADMIN_PASSWORD`. El seed aborta si no están definidas **sin imprimir sus
valores**.

### Seed de demostración (solo desarrollo)

Si quieres datos de ejemplo para desarrollar (catálogo con ofertas, inventario con
alertas de stock, personal con turnos y asignaciones, ventas de los últimos días,
asistencia y equipos), ejecuta:

```bash
npm run db:seed:demo
```

El seed de demostración **reutiliza los casos de uso de la API**, es idempotente
y **exige haber ejecutado antes `npm run db:seed`** (reutiliza sus sucursales, las
variantes base y el usuario administrador). Crea dos sucursales con un usuario por
rol:

| Nombre de usuario | Rol      | Sucursal        |
| ----------------- | -------- | --------------- |
| `gerente.centro`  | Gerente  | Sucursal Centro |
| `empleado.centro` | Empleado | Sucursal Centro |
| `gerente.norte`   | Gerente  | Sucursal Norte  |
| `empleado.norte`  | Empleado | Sucursal Norte  |

Los cuatro usuarios comparten la contraseña de `SEED_DEMO_PASSWORD` (mínimo 12
caracteres). Los empleados usan el PIN fijo de demostración `246810`.

> Es **solo para desarrollo local**: usa una contraseña compartida y el script se
> **niega a ejecutarse con `NODE_ENV=production`**.

## 5. Arrancar el servidor de desarrollo

```bash
npm run start:dev
```

Por defecto escucha en `http://localhost:3000`.

- **API**: `http://localhost:3000/api` (prefijo global declarado en
  `backend/src/app.setup.ts`).
- **Swagger**: `http://localhost:3000/api/docs`, disponible cuando `NODE_ENV` no
  es `production`.

## 6. Probar que todo funciona

```bash
# Inicia sesión con el administrador y copia el token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nombreUsuario":"<admin>","password":"<clave>"}'

# Consulta el perfil autenticado
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <token>"
```

Ver [Referencia de la API](referencia-api.md) para el resto de rutas y la
[Estrategia de pruebas](estrategia-de-pruebas.md) para ejecutar las suites.

## Comandos útiles del backend

Ejecutar desde `backend/`:

| Comando           | Qué hace                                                |
| ----------------- | ------------------------------------------------------- |
| `npm run build`   | Compila TypeScript a `dist/` con el compilador de Nest. |
| `npm run start`   | Arranca la aplicación compilada.                        |
| `npm run start:dev` | Arranca en modo desarrollo con recarga en caliente.  |
| `npm run start:prod` | Arranca el `dist/` compilado con Node.              |
| `npm run lint`    | Ejecuta el linter (oxlint) sobre `src/` y `test/`.     |
| `npm test`        | Pruebas unitarias (sin base de datos).                  |
| `npm run test:e2e` | Pruebas end-to-end (requiere la base `cafeteria_test`).|
| `npm run db:seed` | Aplica el seed sobre la base de `DATABASE_URL`.         |
| `npm run db:seed:demo` | Siembra datos de demostración (solo desarrollo).    |

## Resolución de problemas

- **El puerto 3000 está ocupado**: cambia `PORT` en `backend/.env`. Debe ser un
  entero positivo.
- **`prisma migrate deploy` no conecta**: revisa que `DATABASE_URL` apunte al
  host/puerto correctos y que el contenedor esté levantado (`docker compose up -d`).
- **El seed falla sin mostrar credenciales**: el mensaje indica qué variable falta
  o no cumple el mínimo, pero omite los valores por seguridad.
- **Integridad de la base**: la migración personalizada `db_integrity_rules` añade
  triggers y `CHECK`s que pueden rechazar escrituras; ver
  [Modelo de datos](modelo-de-datos.md).
- **`npm run test:e2e` no encuentra la base de pruebas**: el nombre se deriva de
  `DATABASE_URL` y debe terminar en `_test`. Si no existe, créala una vez:

  ```bash
  docker exec cafeteria-db psql -U cafeteria -d cafeteria_db -c 'CREATE DATABASE cafeteria_test;'
  ```
## Frontend (Vite + React + TypeScript)

El frontend vive en rontend/, es independiente (sin workspaces) y se comunica con el backend mediante el proxy de Vite en desarrollo.

### 1. Variables de entorno del frontend

Copia la plantilla:

`powershell
cd frontend
Copy-Item .env.example .env
`

`ash
cd frontend
cp .env.example .env
`

Variables:

| Variable              | Descripción                                                |
| --------------------- | ----------------------------------------------------------- |
| VITE_API_BASE_URL  | URL base de la API. En desarrollo usar /api (proxy).     |

Por defecto: VITE_API_BASE_URL=/api. En desarrollo, el proxy de Vite redirige /api a http://localhost:3000, por lo que **no es necesario definir CORS_ORIGIN en el backend para que funcione en localhost:5173**. Solo necesitarás CORS_ORIGIN si el frontend se sirve desde un origen distinto al proxy (por ejemplo, http://localhost:4173 al usar 
pm run preview contra backend directo, o un dominio de producción).

### 2. Instalar dependencias e iniciar desarrollo

Desde rontend/:

`ash
npm ci
npm run dev
`

El servidor de desarrollo escucha en http://localhost:5173 (puerto por defecto de Vite). Abre http://localhost:5173/login para iniciar sesión.

### 3. Comandos útiles del frontend

| Comando           | Qué hace                                                |
| ----------------- | ------------------------------------------------------- |
| 
pm run dev     | Servidor de desarrollo Vite.                            |
| 
pm run build   | 	sc -b && vite build (comprueba tipos + genera dist). |
| 
pm run preview | Sirve dist/ localmente.                               |
| 
pm run lint    | ESLint sobre el proyecto.                               |
| 
pm run format  | Prettier formatea archivos.                             |
| 
pm test        | Vitest en modo single-run (itest run).               |
| 
pm run test:watch | Vitest en modo watch.                               |

**Notas:** El token se guarda en **memoria + sessionStorage** (nunca localStorage); riesgo de XSS documentado. El menú y guards se derivan de permisosEfectivos. Zod solo para formularios/parseo crítico (login, /auth/me). El botón de envío de mutaciones críticas se deshabilita mientras la petición está en curso (sin idempotencia en backend).
