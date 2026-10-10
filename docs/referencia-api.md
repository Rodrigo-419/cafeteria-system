# Referencia de la API

Referencia de las **76 rutas implementadas** por el backend. Todas se solicitan
bajo el prefijo global `/api`.

## Convenciones

- **Autenticación**: todas las rutas exigen `Authorization: Bearer <token>`,
  salvo `POST /api/auth/login`. El token se obtiene al iniciar sesión.
- **Permisos**: cada ruta exige el permiso indicado (matriz en
  [Seguridad y permisos](seguridad-y-permisos.md)). Si el token falta o es
  inválido → `401`; si el usuario no tiene el permiso → `403`.
- **Validación**: el `ValidationPipe` global valida cuerpo y query contra el DTO
  declarado; los campos desconocidos se rechazan (`400`).
- **Paginado**: los listados usan `page` y `limit` por query (por defecto 20 en
  la mayoría de los módulos y 10 en equipos).
- **HTTP y contenido**: los `POST` de creación responden `201` con el recurso
  creado; los `DELETE` y algunas acciones responden `204` sin cuerpo; los `PATCH`/
  `PUT` responden `200` con el recurso actualizado.
- **Alcance**: una entidad ajena a la sucursal del usuario se responde `404`
  (no `403`), para no revelar existencia.

## Módulos

### Auth (`/api/auth`)

| Método | Ruta                    | Permiso / nota           | Códigos |
| ------ | ----------------------- | ------------------------ | ------- |
| POST   | `/api/auth/login`       | Pública; límite 5/min/IP | 200, 400, 401 |
| GET    | `/api/auth/me`          | Autenticado              | 200, 401 |

`login` devuelve `{ accessToken, tokenType, expiresIn, user }`; `me` devuelve el
usuario autenticado con sus permisos efectivos.

### Usuarios (`/api/users`)

| Método | Ruta                                    | Permiso | Códigos |
| ------ | --------------------------------------- | ------- | ------- |
| PATCH  | `/api/users/me/password`                | Solo autenticado (exige la contraseña actual) | 204, 400, 401 |
| POST   | `/api/users`                            | `usuarios.crear_editar` | 201, 400, 403, 409 |
| GET    | `/api/users`                            | `usuarios.crear_editar` | 200, 400, 403 |
| GET    | `/api/users/:id`                        | `usuarios.crear_editar` | 200, 400, 403, 404 |
| PATCH  | `/api/users/:id`                        | `usuarios.crear_editar` | 200, 400, 403, 404, 409 |
| PATCH  | `/api/users/:id/estado`                 | `usuarios.crear_editar` | 200, 400, 403, 404, 409 |
| PATCH  | `/api/users/:id/password`               | `usuarios.crear_editar` | 204, 400, 403, 404 |
| GET    | `/api/users/:id/permisos`               | `permisos.asignar`      | 200, 403, 404 |
| PUT    | `/api/users/:id/permisos/:permisoId`    | `permisos.asignar`      | 204, 400, 403, 404, 409 |
| DELETE | `/api/users/:id/permisos/:permisoId`    | `permisos.asignar`      | 204, 400, 403, 404 |

Crear/editar usuarios valida el alcance: un Gerente solo gestiona Empleados de su
sucursal; nadie modifica su propio rol, estado o permisos; no se deja al sistema
sin Admin activo (`409`).

### Sucursales (`/api/branches`)

| Método | Ruta              | Permiso | Códigos |
| ------ | ----------------- | ------- | ------- |
| POST   | `/api/branches`   | `sucursales.crear_editar` | 201, 400, 403, 409 |
| GET    | `/api/branches`   | `sucursales.ver`   | 200, 403 |
| GET    | `/api/branches/:id` | `sucursales.ver` | 200, 403, 404 |
| PATCH  | `/api/branches/:id` | `sucursales.crear_editar` | 200, 400, 403, 404, 409 |

Solo el Admin crea y edita sucursales; no hay borrado. El listado devuelve todas
las sucursales al Admin y solo la propia al resto (`409` si el nombre ya existe,
sin importar mayúsculas ni espacios).

### Productos (`/api/products`)

| Método | Ruta              | Permiso | Códigos |
| ------ | ----------------- | ------- | ------- |
| GET    | `/api/products`   | `productos.ver` | 200, 403 |
| GET    | `/api/products/:id` | `productos.ver` | 200, 403, 404 |
| POST   | `/api/products`   | `productos.catalogo.editar` | 201, 400, 403, 409 |
| PATCH  | `/api/products/:id` | `productos.catalogo.editar` | 200, 400, 403, 404, 409 |
| DELETE | `/api/products/:id` | `productos.catalogo.editar` | 204, 400, 403, 404, 409 |

El catálogo (productos, categorías, variantes) es global y lo edita el Admin.
El borrado responde `409` si el producto tiene precios asociados (dependencias).

### Categorías (`/api/product-categories`)

| Método | Ruta          | Permiso | Códigos |
| ------ | ------------- | ------- | ------- |
| GET    | `/api/product-categories` | `productos.ver` | 200, 403 |
| GET    | `/api/product-categories/:id` | `productos.ver` | 200, 403, 404 |
| POST   | `/api/product-categories` | `productos.catalogo.editar` | 201, 400, 403, 409 |
| PATCH  | `/api/product-categories/:id` | `productos.catalogo.editar` | 200, 400, 403, 404, 409 |
| DELETE | `/api/product-categories/:id` | `productos.catalogo.editar` | 204, 400, 403, 404, 409 |

El borrado de una categoría con productos responde `409`.

### Variantes (`/api/variants`)

| Método | Ruta          | Permiso | Códigos |
| ------ | ------------- | ------- | ------- |
| GET    | `/api/variants` | `productos.ver` | 200, 403 |
| GET    | `/api/variants/:id` | `productos.ver` | 200, 403, 404 |
| POST   | `/api/variants` | `productos.catalogo.editar` | 201, 400, 403, 409 |
| PATCH  | `/api/variants/:id` | `productos.catalogo.editar` | 200, 400, 403, 404, 409 |
| DELETE | `/api/variants/:id` | `productos.catalogo.editar` | 204, 400, 403, 404, 409 |

La variante **"Única"** (sembrada) no puede renombrarse ni eliminarse (`409`); el
borrado de una variante con precios asociados también responde `409`.

### Carta y precios por sucursal (`/api/branches/:sucursalId/products`)

| Método | Ruta                                               | Permiso | Códigos |
| ------ | -------------------------------------------------- | ------- | ------- |
| GET    | `/api/branches/:sucursalId/products`               | `productos.ver` | 200, 403, 404 |
| PUT    | `/api/branches/:sucursalId/products/:productoId/variants/:varianteId` | `productos.precio.editar` | 200, 400, 403, 404, 409 |

El `PUT` crea o actualiza el precio/estado (`activo`/`inactivo`) de una variante
en la sucursal. Solo el Gerente (de la sucursal de la ruta); el precio es un
decimal con 2 dígitos (mín 0,01, máx 100 000). Un Empleado solo ve ofertas
activas en la carta.

### Insumos (`/api/insumos`)

| Método | Ruta              | Permiso | Códigos |
| ------ | ----------------- | ------- | ------- |
| POST   | `/api/insumos`    | `insumos.catalogo.editar` | 201, 400, 403, 409 |
| GET    | `/api/insumos`    | `insumos.ver` | 200, 403 |
| GET    | `/api/insumos/:id` | `insumos.ver` | 200, 403, 404 |
| PATCH  | `/api/insumos/:id` | `insumos.catalogo.editar` | 200, 400, 403, 404, 409 |
| DELETE | `/api/insumos/:id` | `insumos.catalogo.editar` | 204, 400, 403, 404, 409 |

El catálogo de insumos es global (Admin). Eliminar un insumo con stock en alguna
sucursal responde `409`.

### Inventario por sucursal (`/api/inventario/sucursales/:sucursalId`)

| Método | Ruta                                  | Permiso | Códigos |
| ------ | ------------------------------------- | ------- | ------- |
| GET    | `/api/inventario/sucursales/:sucursalId/stock` | `insumos.ver` | 200, 403, 404 |
| PUT    | `/api/inventario/sucursales/:sucursalId/insumos/:insumoId` | `inventario.minimo.editar` | 200, 400, 403, 404, 409 |
| POST   | `/api/inventario/sucursales/:sucursalId/insumos/:insumoId/entradas` | `inventario.registrar` | 201, 400, 403, 404, 409 |

El `PUT` da de alta el insumo en la sucursal y ajusta `stockMinimo` y estado.
Las `entradas` suman cantidad (obligatoriamente `> 0`) y registran el movimiento.
El listado de stock admite filtro `soloBajoMinimo`.

### Movimientos (`/api/inventario/sucursales/:sucursalId/movimientos`)

| Método | Ruta                                                     | Permiso | Códigos |
| ------ | -------------------------------------------------------- | ------- | ------- |
| GET    | `/api/inventario/sucursales/:sucursalId/movimientos`     | `inventario.registrar` | 200, 400, 403, 404 |

Historial de variaciones de stock (entradas y ajustes) de la sucursal, con filtros
`insumoId`, `tipo`, `desde`, `hasta`.

### Recuentos (`/api/inventario/...`)

| Método | Ruta                                  | Permiso | Códigos |
| ------ | ------------------------------------- | ------- | ------- |
| POST   | `/api/inventario/sucursales/:sucursalId/recuentos` | `inventario.recuento` | 201, 400, 403, 404, 409 |
| GET    | `/api/inventario/recuentos`           | `inventario.recuento` | 200, 400, 403 |
| GET    | `/api/inventario/recuentos/:id`       | `inventario.recuento` | 200, 403, 404 |

Un recuento ajusta el stock al valor físico contado (única vía de bajarlo). Va en
una transacción con renglones bloqueados; si algo falla no queda recuento ni
cambio. El listado siempre se acota al alcance (Gerente: su sucursal; Admin:
todas).

### Alertas (`/api/inventario/alertas`)

| Método | Ruta                     | Permiso | Códigos |
| ------ | ------------------------ | ------- | ------- |
| GET    | `/api/inventario/alertas` | `alertas.ver_resolver` | 200, 400, 403 |

Solo lectura: las alertas se abren/cierran automáticamente, en la misma
transacción que cambió stock o mínimo.

### Ventas (`/api/sales`)

| Método | Ruta                 | Permiso | Códigos |
| ------ | -------------------- | ------- | ------- |
| POST   | `/api/sales`         | `ventas.registrar` | 201, 400, 403, 404, 409 |
| GET    | `/api/sales`         | `ventas.ver` | 200, 400, 403 |
| GET    | `/api/sales/:id`     | `ventas.ver` | 200, 403, 404 |
| POST   | `/api/sales/:id/anular` | `ventas.anular` | 200, 400, 403, 404, 409 |

- `POST /api/sales` registra una venta en la **sucursal del vendedor**. Requiere
  `metodoPago` (`efectivo`/`tarjeta`) e `items`. Reglas verificables en el código:
  entre **1 y 100 líneas**, cada línea con **cantidad entera de 1 a 9999** y sin
  productos repetidos; solo ofertas activas de la sucursal; el servidor calcula
  subtotales y total y congela el precio en un snapshot.
- `POST /api/sales/:id/anular` anula una venta del **mismo día** con un `motivo`
  de entre 1 y 200 caracteres. La anula el **Gerente** (cualquier venta de su
  sucursal) **o quien la registró**: un Empleado solo anula las ventas que él
  mismo registró (una ajena responde **403**). El Admin no registra ni anula
  ventas.
- El método de pago es solo registro: no hay procesamiento de cobro real.

### Equipos (`/api/equipment`)

| Método | Ruta                     | Permiso | Códigos |
| ------ | ------------------------ | ------- | ------- |
| POST   | `/api/equipment`         | `equipo.registrar_editar` | 201, 400, 403, 404 |
| PATCH  | `/api/equipment/:id`     | `equipo.registrar_editar` | 200, 400, 403, 404, 409 |
| GET    | `/api/equipment`         | `equipo.ver` | 200, 400, 403 |
| GET    | `/api/equipment/:id`     | `equipo.ver` | 200, 403, 404 |
| GET    | `/api/equipment/:id/history` | `equipo.ver` | 200, 400, 403, 404 |

Estados válidos: `funcionando`, `danado`, `en_mantenimiento`, `retirado`. El
historial solo se escribe al cambiar estado u observaciones. Alcance: el Admin ve
todos; un Gerente solo los de su sucursal (forzada por servidor); un Empleado solo
con `equipo.ver` concedido individualmente. No existen borrados de equipos.

### Empleados (`/api/employees`)

| Método | Ruta                     | Permiso | Códigos |
| ------ | ------------------------ | ------- | ------- |
| POST   | `/api/employees`         | `empleados.crear_editar` | 201, 400, 403, 404, 409 |
| GET    | `/api/employees`         | `empleados.crear_editar` | 200, 400, 403 |
| GET    | `/api/employees/:id`     | `empleados.crear_editar` | 200, 403, 404 |
| PATCH  | `/api/employees/:id`     | `empleados.crear_editar` | 200, 400, 403, 404 |
| POST   | `/api/employees/:id/cese` | `empleados.crear_editar` | 200, 400, 403, 404, 409 |
| POST   | `/api/employees/:id/pin` | `empleados.crear_editar` | 200, 403, 404 |

- `POST /api/employees` vincula a un **usuario existente** (`usuarioId`) con un
  `cargo` y una `fechaContratacion` (`YYYY-MM-DD`). El empleado **hereda la
  sucursal del usuario**, que debe tener rol **Empleado o Gerente** (un Admin
  responde `400`; un usuario ya vinculado responde `409`). Alcance: Admin gestiona
  todos; Gerente solo empleados de usuarios **Empleado** de su sucursal (fuera,
  `404`).
- `PATCH /api/employees/:id` actualiza solo el `cargo`.
- `POST /api/employees/:id/cese` cesa al empleado (queda `inactivo`, conserva el
  histórico) y **bloquea la cuenta del usuario vinculado en la misma
  transacción**. `fechaCese` opcional (por defecto hoy, América/Lima) y nunca
  anterior a la de contratación (`400`); un empleado ya cesado responde `409`.
- `POST /api/employees/:id/pin` regenera el **PIN de marcación**: 6 dígitos
  generados por el sistema, devuelto **una sola vez**; en la base solo queda su
  hash bcrypt. El listado/detalle de empleados nunca incluye el PIN ni su hash.

### Turnos (`/api/shifts`)

| Método | Ruta               | Permiso          | Códigos                 |
| ------ | ------------------ | ---------------- | ----------------------- |
| POST   | `/api/shifts`      | `turnos.editar`  | 201, 400, 403, 404      |
| GET    | `/api/shifts`      | `turnos.editar`  | 200, 400, 403           |
| GET    | `/api/shifts/:id`  | `turnos.editar`  | 200, 403, 404           |
| PATCH  | `/api/shifts/:id`  | `turnos.editar`  | 200, 400, 403, 404, 409 |

- Un turno es `fijo` (con `horaInicio` y `horaFin`, `horaFin > horaInicio`, sin
  cruzar medianoche, y `diasSemana`) o `variable` (sin horario). `diasSemana` son
  números ISO `1-7` separados por comas, sin repetir y en orden ascendente.
- Alcance: el Admin elige la sucursal (400 si falta, 404 si no existe); el
  Gerente la tiene **forzada** a la suya. Un Gerente no ve turnos de otra
  sucursal (`404`).
- `PATCH /api/shifts/:id` solo edita horas y `diasSemana` (nunca el tipo ni la
  sucursal) y responde `409` si dejaría **solapadas asignaciones vigentes** del
  mismo empleado. No existe DELETE de turnos.
- `GET /api/shifts` acepta filtros `sucursalId` y `tipo`, y pagina con `page` y
  `limit` (≤ 100).

### Asignaciones (`/api/assignments`)

| Método | Ruta                    | Permiso          | Códigos           |
| ------ | ----------------------- | ---------------- | ----------------- |
| POST   | `/api/assignments`      | `turnos.editar`  | 201, 400, 403, 404, 409 |
| GET    | `/api/assignments`      | `turnos.editar`  | 200, 400, 403     |
| PATCH  | `/api/assignments/:id`  | `turnos.editar`  | 200, 400, 403, 404 |

- `POST /api/assignments` asigna un turno a un empleado de la **misma sucursal**
  (si no, `404`); el empleado debe estar **activo** (`409` si está cesado);
  `fechaInicio` (`YYYY-MM-DD`) no puede ser anterior a la contratación (`400`) y
  `fechaFin` opcional no puede ser anterior a `fechaInicio` (`400`).
- **Solapamiento** (`409`): el mismo empleado no puede tener dos asignaciones con
  rangos de fechas solapados cuyos turnos a su vez se crucen (ambos fijos con
  días y horas cruzados, o alguno variable). La comprobación se hace en una
  transacción que bloquea la fila del empleado, de modo que dos altas simultáneas
  conflictivas solo dejan pasar una.
- `PATCH /api/assignments/:id` **retira** la asignación fijando `fechaFin`, que no
  puede ser anterior a la de inicio ni a hoy (América/Lima) (`400`). No existe
  DELETE: retirar es cerrar la vigencia.
- `GET /api/assignments` acepta filtros `empleadoId`, `turnoId` y `vigente=true`
  (solo las vigentes hoy), y pagina con `page` y `limit` (≤ 100).

### Asistencia (`/api/attendance`)

| Método | Ruta                                    | Permiso               | Códigos                 |
| ------ | --------------------------------------- | --------------------- | ----------------------- |
| POST   | `/api/attendance/mark`                  | `asistencia.marcar`   | 201, 400, 403, 404, 409, 429 |
| GET    | `/api/attendance/terminal/employees`    | `asistencia.marcar`   | 200, 403                |
| POST   | `/api/attendance/records/:id/correct`   | `asistencia.corregir` | 201, 400, 403, 404, 409 |
| POST   | `/api/attendance/absences/justify`      | `asistencia.corregir` | 201, 400, 403, 404, 409 |
| GET    | `/api/attendance/records`               | `asistencia.ver`      | 200, 400, 403, 404      |
| GET    | `/api/attendance/records/:id`           | `asistencia.ver`      | 200, 403, 404           |
| GET    | `/api/attendance/absences`              | `asistencia.ver`      | 200, 400, 403, 404      |

- **Marcar** (`POST /mark`, cuerpo `{ empleadoId, tipo: 'entrada' | 'salida', pin }`):
  la **hora la pone el servidor** con `metodo = 'pin'`; se registra en la sucursal
  del usuario autenticado. El `fechaHora` que envíe el cliente se **ignora**. El
  Admin (sin sucursal) recibe **403**; un empleado de otra sucursal, inactivo o
  inexistente, **404**. El PIN se valida contra su hash bcrypt (`403` si no
  coincide; si el empleado no tiene PIN también **403**). Con **5 fallos en 1
  minuto** la marcación responde **429** aunque el PIN sea correcto. **409** para
  doble marcaje: una entrada con otra entrada abierta del **mismo día** (América/
  Lima), o una salida sin entrada abierta del mismo día.
- **Terminal** (`GET /terminal/employees`): solo `id` y `nombre` de los empleados
  **activos** de la sucursal del actor. El Admin sin sucursal recibe **403**.
- **Corregir** (`POST /records/:id/correct`, cuerpo `{ motivo (1-200), fechaHora
  (ISO), tipo? }`): inserta una **fila nueva** (`esCorreccion = true`) que
  **reemplaza la hora** del registro efectivo; el original queda intacto. Solo se
  corrigen registros **originales** (corregir una corrección → `400`); **una
  corrección por par (original, tipo)** → `409`; `fechaHora` no puede ser futura
  (`400`). Si el original es una **entrada abierta** y se corrige como **salida**,
  es un **cierre administrativo**: la salida debe ser **posterior** a la entrada
  (`400`) y la entrada debe seguir abierta (`409` si ya está cerrada). Registro de
  otra sucursal → `404`. El **Admin no tiene** `asistencia.corregir` (`403`) y un
  Gerente no corrige sus propios registros (`403`).
- **Justificar falta** (`POST /absences/justify`, cuerpo `{ empleadoId, fecha
  (YYYY-MM-DD), motivo (1-200) }`): registra la justificación del actor. `409` si
  el día ya está justificado o si hay una entrada efectiva ese día; `400` si la
  fecha es futura o anterior a la contratación; empleado fuera de alcance → `404`.
- **Registros** (`GET /records`): filtros `empleadoId`, `sucursalId`, `desde`,
  `hasta`, `abierta=true`, y `page`/`limit` (≤ 100). Alcance: Admin todo; Gerente
  solo su sucursal (fuera → `404`); Empleado solo lo suyo. `GET /records/:id`
  devuelve el registro con su lista de `correcciones[]`.
- **Faltas** (`GET /absences`): **exige** el rango `desde`-`hasta` (`YYYY-MM-DD`) y
  no admite más de **92 días** (`400`). Una falta es un día con asignación vigente
  de un turno **fijo** cuyo `diasSemana` incluye ese día, sin entrada efectiva y
  sin justificación; los **turnos variables no generan faltas** y solo se cuentan
  días hasta hoy (América/Lima).
- **Registro efectivo**: las correcciones no son marcaciones nuevas; sustituyen la
  hora del original. "Abierta" significa entrada efectiva **sin salida efectiva
  posterior**.

### Reportes (`/api/reports`)

| Método | Ruta                     | Permiso                   | Códigos       |
| ------ | ------------------------ | ------------------------- | ------------- |
| GET    | `/api/reports/comparativo` | `reportes.comparativos.ver` | 200, 400, 403, 404 |

- Solo **lectura** y solo para el **Admin** (permiso `reportes.comparativos.ver`):
  un Gerente o Empleado recibe **403**; sin token, **401**.
- **Query obligatoria** `desde` y `hasta` (`YYYY-MM-DD`, día local America/Lima),
  con `hasta >= desde` (**400** si no) y un máximo de **92 días** (**400** si se
  supera). `sucursalId` opcional filtra el reporte a una sucursal; una
  inexistente responde **404**.
- La respuesta trae `{ desde, hasta, generadoEn, sucursales: [...] }`, **una fila
  por sucursal** (todas, incluso sin datos, con ceros) ordenadas por **nombre**:
  - `ventas` (del período): `total`, `cantidad`, `ticketPromedio` (`null` si no
    hubo ventas), `porMetodoPago.efectivo`/`.tarjeta` (`total` y `cantidad`) y
    `anuladas.cantidad`. Importes como string con 2 decimales.
  - `inventario.movimientos` (del período): `total` y, por tipo
    (`entradas`/`ajustes`), `cantidad` y `cantidadNeta` (variación ±).
  - `asistencia` (del período): `faltas` (misma regla que
    `GET /attendance/absences`) y `faltasJustificadas`.
  - `estadoActual`: `insumosConAlertaAbierta` y `entradasAbiertas`, **al momento
    de generar** el reporte (no son cifras del período).

## Códigos de error más comunes

| Código | Significado                                                  |
| ------ | ------------------------------------------------------------ |
| 400    | Validación del DTO fallida (campo inválido o desconocido).   |
| 401    | Sin token, token inválido o expirado; credenciales incorrectas. |
| 403    | Usuario autenticado pero sin el permiso (o sin alcance sobre la entidad). |
| 404    | Recurso inexistente o fuera del alcance del usuario.         |
| 409    | Conflicto con el estado (registro duplicado, dependencias, acción no permitida). |
| 429    | Demasiados intentos (p. ej. protección de fuerza bruta del PIN de asistencia). |

## Documentos relacionados

- Alcances y reglas por rol: [Seguridad y permisos](seguridad-y-permisos.md).
- Modelo subyacente: [Modelo de datos](modelo-de-datos.md).
- Decisiones y discrepancias conocidas (p. ej. límites reales de líneas/cantidad
  de venta): [Decisiones de diseño](architecture/decisiones-de-diseno.md).