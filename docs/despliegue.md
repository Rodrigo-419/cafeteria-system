# Despliegue

Arquitectura objetivo: **backend en Render** (NestJS + Prisma), **frontend en
Netlify** (React + Vite) y **base de datos Neon** (PostgreSQL serverless). Los
tres archivos de configuración viven en la raíz del monorepo:

| Archivo | Servicio |
| ------- | -------- |
| [`render.yaml`](render.yaml) | Blueprint del backend en Render |
| [`netlify.toml`](netlify.toml) | Build y despliegue del frontend en Netlify |
| [`backend/.env.example`](backend/.env.example) | Plantilla de variables del backend |
| [`frontend/.env.example`](frontend/.env.example) | Plantilla de variables del frontend |

## Versión de Node

**Node 24** (la misma que usa la CI). Se fija en dos sitios para que Render la
coja sin tener que tocar el panel:

- `engines.node: ">=24"` en `backend/package.json`.
- `.node-version` con `24` en la raíz.

El frontend se compila en Netlify con `NODE_VERSION = "24"` en
[`netlify.toml`](netlify.toml).

## Base de datos (Neon)

Neon es serverless: **suspende la base por inactividad** y la primera consulta
después de un tiempo sin tráfico tarda varios segundos y puede fallar con un
error de conexión. Ese comportamiento es exactamente el que mitigamos (ver
[Arranque en frío](#arranque-en-frío) y [Reconexión de la primera consulta](#reconexión-de-la-primera-consulta)).

1. Crea un proyecto en Neon y anota la **URL pooled** (la que usa la app).
2. Para las migraciones, Neon recomienda la **URL directa** (sin pooler); se usa
   solo en el build de Render (`npx prisma migrate deploy`).
3. Pega la URL pooled en `DATABASE_URL` del backend en Render.

## Backend en Render

### Comandos de build y arranque

De `render.yaml`:

```yaml
rootDir: backend
buildCommand: npm ci --include=dev && npx prisma generate && npx prisma migrate deploy && npm run build
startCommand: npm run start:prod
healthCheckPath: /api/health
```

- `--include=dev` porque con `NODE_ENV=production` `npm ci` omitiría las
  devDependencies, y Prisma CLI (necesaria para `generate` y `migrate deploy`)
  es una devDependency.
- `npm run start:prod` ejecuta `node dist/main`; `main.ts` escucha en
  `0.0.0.0:$PORT` (Render inyecta `PORT`).
- `npx prisma migrate deploy` aplica las migraciones del repositorio; no usa
  `db push`, así que el esquema desplegado es exactamente el del repo.

### Ruta de salud

`GET /api/health` devuelve `{ "estado": "ok" }` y **no toca la base de datos**.
Está marcada como pública (`@Public()`) y excluida del límite de peticiones
(`@SkipThrottle()`), para que el health check de Render no consuma cupo ni falle
si la base se está despertando.

### Variables de entorno

| Variable | Valor en Render | ¿Sensible? | Notas |
| -------- | --------------- | ---------- | ----- |
| `NODE_ENV` | `production` | no | Desactiva Swagger y el seed de demostración. |
| `TRUST_PROXY` | `1` | no | Un salto: Render es el único proxy inverso. |
| `JWT_EXPIRES_IN` | `8h` | no | Vigencia del token de acceso. |
| `DATABASE_URL` | URL pooled de Neon | **sí** | `sync: false`. |
| `JWT_SECRET` | cadena de ≥32 caracteres | **sí** | `sync: false`. |
| `CORS_ORIGIN` | URL de Netlify (y la de preview si procede) | no | `sync: false`. |

Las sensibles llevan `sync: false`: Render no las gestiona ni las sobrescribe,
así que un valor del repositorio no puede pisar la URL o el secreto reales.

### `TRUST_PROXY` y el límite de intentos

El control de intentos de login identifica al cliente por IP. Express solo usa
`X-Forwarded-For` para calcular la IP si se fija `trust proxy`.

- En Render el valor correcto es **`1`** (un salto): hay un único proxy inverso
  delante del servicio. Con `true` se confiaría en *todos* los saltos y el
  límite podría equivocarse de IP; con `false` todos los clientes compartirían la
  IP del proxy y el límite global se dispararía entre personas de una misma
  sucursal.
- **Cómo verificarlo:** la suite `backend/test/trust-proxy.e2e-spec.ts` cubre
  los tres casos. Con `TRUST_PROXY=1`, cambiando la IP declarada en
  `X-Forwarded-For` cada intento tiene su propio límite (no hay bloqueo), y
  repitiendo la misma IP sí se llega al `429`.

### Swagger desactivado en producción

`main.ts` solo publica Swagger si `NODE_ENV !== 'production'`
(`debeHabilitarDocumentacion` en `backend/src/config/swagger.config.ts`). En
producción la ruta `/api/docs` no existe. La decisión está extraída a una
función pura y cubierta por `swagger.config.spec.ts`.

### Sin secretos con valor por defecto

`DATABASE_URL` y `JWT_SECRET` son obligatorias en **cualquier** entorno, también en
producción. Si falta alguna, el arranque falla en la validación de Zod con un
mensaje que nombra la variable y el motivo **sin mostrar el valor recibido**
(`validate` en `backend/src/config/env.config.ts`). Cubierto por
`env.config.spec.ts`.

## Frontend en Netlify

`netlify.toml` configura:

- `base = "frontend"`, `command = "npm run build"`, `publish = "dist"`.
- Redirección SPA (`/*` -> `/index.html`).
- Cabeceras de seguridad y caché de `assets/`.
- `NODE_VERSION = "24"`.

### Variable de entorno

En Netlify define `VITE_API_BASE_URL` con la URL **absoluta** del backend:

```
VITE_API_BASE_URL=https://cafeteria-backend.onrender.com/api
```

En desarrollo se deja `/api` y el proxy de Vite resuelve contra
`http://localhost:3000`. No debe quedar ninguna URL fija a `localhost` en
producción.

## Arranque en frío

El plan gratuito de Render suspende el backend por inactividad; la primera
petición tras un rato sin tráfico tarda decenas de segundos. El frontend lo
detecta y lo comunica:

- Se considera arranque en frío si el login o una petición inicial **tarda más
  de ~4 s** o falla por red, `502`, `503` o `504`.
- Se muestra el mensaje **"El servidor está despertando, puede tardar hasta un
  minuto"** (sin detalles técnicos).
- Reintento automático y acotado, con un **tope de ~90 s**; después muestra el
  mensaje y deja de insistir.
- Solo se aplica al **login** y al **refresco de sesión** (`GET /auth/me`); no
  cambia los tiempos del resto de llamadas.

Implementado en `frontend/src/lib/api/arranque-en-frio.ts`, con pruebas en
`arranque-en-frio.test.ts`, `LoginPage.test.tsx` y `AuthContext.test.tsx`.

## Reconexión de la primera consulta

Aunque el arranque del backend reintente la conexión (`onModuleInit` con
reintento), la **primera consulta** contra una base recién despertada puede fallar
con un error de conexión. El backend reintenta esa primera consulta de lectura
de forma acotada y segura:

- **Cubre:** las dos lecturas que abren una petición —
  `buscarUsuarioPorNombreUsuario` (login) y `buscarUsuarioPorId` (refresco)—
  (`AuthRepository`). Se reintenta solo ante errores de conexión (`P1001`,
  `P1002`, `P1008`, `P1017`, `P2024`, `ECONNRESET`, `ECONNREFUSED`, `ETIMEDOUT`,
  `EPIPE`, …), 3 intentos con 500 ms entre ellos.
- **No cubre:**
  - **Escrituras** (`INSERT`/`UPDATE`/`DELETE`): nunca se reintentan. Si una
    escritura falló por conexión pudo haberse aplicado y repetirla duplicaría el
    efecto.
  - Errores que no son de conexión (validación, restricciones, permisos…): se
    propagan sin reintento.
  - Consultas distintas de las dos de arranque: el resto de repositorios no usan
    el reintento.

La lógica es pura y está en `backend/src/database/reconexion-prisma.ts`, con
pruebas en `reconexion-prisma.spec.ts` y `auth.repository.spec.ts`.

## Protección del seed contra bases remotas

`npm run db:seed` y `npm run db:seed:demo` **escriben** datos. Antes de escribir:

1. Muestran el **host** y el **nombre de la base** de destino.
2. Si el destino **no es local**, exigen una confirmación explícita: el
   argumento `--confirm` (o `--confirmar`, `--yes`, `-y`) **o** la variable
   `SEED_CONFIRMAR_REMOTO=1`.

Sin esa confirmación se niegan con un mensaje claro y **no escriben nada**.
Además:

- Una `DATABASE_URL` del entorno tiene **prioridad** sobre la de `backend/.env`
  (`dotenv` no pisa variables ya presentes; `@nestjs/config` hace lo mismo).
- `db:seed:demo` sigue negándose con `NODE_ENV=production`
  (`asegurarEntornoDemo`).

### Lanzar los seeds contra Neon desde tu PC

Linux / macOS:

```bash
cd backend
export DATABASE_URL="postgresql://usuario:clave@host-pooler.neon.tech/cafeteria_db?sslmode=require"
export SEED_ADMIN_USUARIO=admin
export SEED_ADMIN_PASSWORD='elige-una-clave-de-al-menos-12-caracteres'
npm run db:seed -- --confirm
npm run db:seed:demo -- --confirm
```

Windows (PowerShell):

```powershell
cd backend
$env:DATABASE_URL="postgresql://usuario:clave@host-pooler.neon.tech/cafeteria_db?sslmode=require"
$env:SEED_ADMIN_USUARIO="admin"
$env:SEED_ADMIN_PASSWORD="elige-una-clave-de-al-menos-12-caracteres"
npm run db:seed -- --confirm
npm run db:seed:demo -- --confirm
```

Notas:

- `--confirm` va después de `--` para que npm lo reenvíe al script.
- No definas `SEED_DEMO_PASSWORD` en producción: el seed demo crea usuarios con
  una contraseña compartida y datos ficticios, y se niega a correr con
  `NODE_ENV=production`.
- El host se muestra antes de escribir; comprueba que es el de Neon y no otra
  base.

La lógica pura está en `backend/src/database/seed-ambiente.ts`, con pruebas en
`seed-ambiente.spec.ts`.

## Verificación

```bash
# Backend
cd backend
npm ci && npm run build && npm run lint
npm test            # unitarias
npm run test:e2e    # e2e (requiere Docker)

# Frontend
cd frontend
npm ci && npm run build && npm run lint
npm test            # 3x con CI=true
```

Cifras de pruebas y desglose por suite en
[Estrategia de pruebas](estrategia-de-pruebas.md).
