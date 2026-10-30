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
| `EXPORT_MAX_FILAS_POR_CONJUNTO` | `3000` | no | Ajustado a los 512 MB de Render; el default del código sigue siendo `10000`. |
| `EXPORT_MAX_FILAS_TOTALES` | `6000` | no | Ajustado a los 512 MB de Render; el default del código sigue siendo `20000`. |
| `EXPORT_TIMEOUT_MS` | `60000` | no | Plazo de una exportación en milisegundos. Debe quedar por debajo de los 90 s que espera el frontend. |

Las sensibles llevan `sync: false`: Render no las gestiona ni las sobrescribe,
así que un valor del repositorio no puede pisar la URL o el secreto reales.

### Memoria de las exportaciones

El plan gratuito de Render da **512 MB para todo el proceso** (NestJS, Prisma,
conexiones y la exportación en curso). Por eso `render.yaml` fija topes más
bajos que los defaults del código:

- **3 000 filas por conjunto** y **6 000 en el libro completo** en producción
  (Render), con
  `EXPORT_MAX_FILAS_POR_CONJUNTO` y `EXPORT_MAX_FILAS_TOTALES`. Los defaults de
  `limites.ts` siguen siendo **10 000** y **20 000** para otros entornos; no se
  cambiaron.
- **Una exportación concurrente por usuario y una global**. El límite global
  evita que dos archivos grandes coincidan en el mismo proceso.
- **Una exportación nunca deja su ranura tomada.** La ranura se libera en el
  `finally` de cada exportación: al terminar bien, al fallar, cuando el cliente
  corta la descarga y cuando vence `EXPORT_TIMEOUT_MS`. Antes, un cliente que
  cerraba el navegador a mitad del XLSX dejaba la ranura tomada para siempre y
  el usuario recibía `429` en todos los intentos siguientes.
- Los **14 lectores actuales materializan el array completo** antes de
  escribir. Los que usan `contarYLeer` evitan el `findMany` si el total supera
  el tope, pero dentro del tope cargan todas las filas; **asistencia y faltas
  cargan todos los registros antes de calcular y recortar**. Por eso los topes
  no se pueden subir sin cambiar la lectura.
- La **Fase 2** introducirá lectura por lotes con cursor (`FILAS_POR_LOTE`),
  escribiendo cada lote al CSV/XLSX antes de pedir el siguiente; entonces se
  podrán elevar los topes. La decisión y el alcance están en
  [`docs/architecture/decisiones-de-diseno.md`](architecture/decisiones-de-diseno.md#15-módulo-exportaciones-exports).
- Los rechazos `413`/`429` solo sugieren filtros que existen: los conjuntos de
  actividad (`ventas`, `movimientos`, `asistencia`, `faltas`, `reporte`) piden
  acotar el rango de fechas; los demás no admiten rango y piden reducir el
  volumen; el libro completo pide exportar los conjuntos por separado. **No hay
  filtro libre por sucursal**: el Gerente queda limitado a la suya y el Admin
  exporta todas.

### Cancelación y plazo de una exportación

- **Plazo:** `EXPORT_TIMEOUT_MS` (60 000 ms por defecto y en Render). Al vencer,
  el backend abandona la generación, libera la ranura y deja
  `exportacion_fallida` con el motivo. Si todavía no había enviado la cabecera,
  responde **503** con un mensaje en español; si el archivo ya se estaba
  enviando, solo corta la respuesta.
- **Cliente que corta:** el `close` de la respuesta corta la generación igual
  que el plazo, deja `exportacion_fallida` («El cliente cortó la descarga antes
  de terminar») y libera la ranura. El XLSX se envía con `pipeline`, así que el
  `PassThrough` se destruye y `workbook.commit()` deja de esperar.
- **Frontend:** Cancelar restablece la pantalla al instante, sin esperar a que
  el servidor reaccione. La espera máxima es de **90 s** (más que el plazo del
  backend) con un mensaje claro, y **no hay reintento automático**.
- Si se sube `EXPORT_TIMEOUT_MS`, hay que revisar el plazo del frontend
  (`TIEMPO_MAXIMO_EXPORTACION_MS` en
  `frontend/src/features/exports/useExportacion.ts`), que debe seguir siendo
  mayor.

**Mediciones locales (Jest, no Render).** La prueba actual solo aserta el
**delta de heap** del propio escenario (techo: 256 MB). Se observaron deltas de **20-49 MB**
con 10 000 ventas, **48-84 MB** con el libro completo (10 000 ventas y 9 000
auditorías) y **0,8-87 MB** con 20 000 ventas; el recolector de basura puede
dejar ese delta cerca de cero. Los picos absolutos dependen de la memoria
acumulada por las suites anteriores en el mismo proceso de Jest; en una
ejecución aislada, el caso de 20 000 ventas llegó a **345,8 MB de heap** y
**1800,5 MB de RSS**. **Advertencia:** ese RSS incluye Jest, Nest, Prisma y
Supertest; no es el proceso aislado de Render y **no se midió en Render**. **La
verificación real es observar la memoria del servicio en el panel de Render
durante una exportación.**

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

## Auditoría de dependencias

El **2026-10-27** se ejecutó, sin cambiar versiones ni ejecutar `audit fix`:

```bash
# desde la raíz del repositorio
cd backend && npm audit --omit=dev --registry=https://registry.npmjs.org
cd ../frontend && npm audit --omit=dev --registry=https://registry.npmjs.org
```

Resultado: **backend 12 vulnerabilidades (4 moderadas y 8 altas)** y **frontend
1 alta**. Ambos comandos terminan con código 1 por los hallazgos.

| Paquete | Severidad | Cadena / uso | Alcanzabilidad real |
| --- | --- | --- | --- |
| `body-parser` | alta | `express` -> `body-parser` (runtime) | **Alcanzable**: el parser de Express procesa cuerpos comprimidos antes de los guards; el límite global de 300 req/min reduce el volumen, pero no elimina el DoS. |
| `multer` | alta | `@nestjs/platform-express` (runtime) | **No alcanzable hoy**: no hay ningún `FileInterceptor` ni ruta de subida; el paquete queda cargado como dependencia de la plataforma. |
| `qs` | moderada | `express`/`supertest` | **No alcanzable en el servidor**: el aviso afecta a `qs.stringify` con `arrayFormat: 'comma'`; la API solo parsea query/urlencoded. `supertest` es de pruebas. |
| `zod` (backend) | alta | `zod` (runtime) | **No alcanzable desde peticiones**: solo valida `process.env` al arrancar (`env.config.ts`); los DTO HTTP usan `class-validator`. |
| `zod` (frontend) | alta | `zod` y `@hookform/resolvers` | **Solo cliente**: valida formularios en el navegador; una entrada manipulada podría consumir memoria de la pestaña, no del backend. |
| `uuid` | moderada | `exceljs` -> `uuid` | **No alcanzable por la ruta vulnerable**: el aviso afecta a `v3`/`v5`/`v6` con buffer; ExcelJS usa `uuid.v4()` sin buffer. |
| `deepmerge-ts`, `@prisma/config`, `mysql2` | alta | `prisma` (CLI, `devDependencies`) | **Solo build**: se usan en `prisma generate`/`migrate deploy`; no se cargan en `start:prod`. |
| `fast-uri` | moderada | `@nestjs/cli` -> `@angular-devkit/core` -> `ajv` | **Solo build**: herramienta de CLI; no forma parte del runtime de Nest. |

`npm audit --omit=dev` sigue mostrando cadenas de `prisma` y de `@nestjs/cli`
porque npm las resuelve desde el lockfile; `render.yaml` instala también
`devDependencies` para poder ejecutar Prisma durante el build. **No se
modificaron versiones en esta entrega**: los avisos quedan documentados y la
actualización compatible debe hacerse en una tarea aparte, verificando antes
las suites. La comprobación en producción (Render/Neon) no se ha hecho en esta
entrega.

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
