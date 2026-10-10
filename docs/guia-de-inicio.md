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
docker exec cafeteria-db pg_isready -U <usuario> -d <base>
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
| `SEED_ADMIN_EMAIL`    | Correo del usuario administrador inicial.                   |
| `SEED_ADMIN_PASSWORD` | Contraseña del administrador (mínimo 12 caracteres).        |
| `JWT_SECRET`          | Secreto para firmar tokens (mínimo 32 caracteres).          |
| `JWT_EXPIRES_IN`      | Vigencia del token; el valor por defecto es `8h`.           |

> El `.env` del backend **no está versionado** (ver `backend/.gitignore`). Nunca
> se suben secretos al repositorio.

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

El administrador se crea con el correo y la contraseña de `SEED_ADMIN_EMAIL` y
`SEED_ADMIN_PASSWORD`. El seed aborta si no están definidas **sin imprimir sus
valores**.

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
  -d '{"email":"<admin>","password":"<clave>"}'

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
  docker exec cafeteria-db psql -U <usuario> -c 'CREATE DATABASE cafeteria_test;'
  ```