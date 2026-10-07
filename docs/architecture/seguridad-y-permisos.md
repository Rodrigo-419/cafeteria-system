# Seguridad y permisos

Cómo autentica el backend, qué roles y permisos existen, cómo se conceden los
permisos individuales y qué alcance tiene cada módulo.

## 1. Autenticación

- **Mecanismo**: JWT firmado con `JWT_SECRET` (obligatorio, mínimo 32 caracteres).
  El token viaja en la cabecera `Authorization: Bearer <token>`.
- **Vigencia**: `JWT_EXPIRES_IN`, por defecto `8h`. No hay token de refresco: al
  vencer, se vuelve a iniciar sesión.
- **Login**: `POST /api/auth/login` es la única ruta pública. Está limitada a
  **5 intentos por minuto por IP** (`@Throttle` a nivel de controlador). El límite
  global de la API es de 100 peticiones/minuto (`ThrottlerModule` en `AppModule`).
- **Misma respuesta para credenciales incorrectas**: cuando el correo no existe se
  compara la contraseña contra un *hash falso* fijo para no revelar, por el tiempo
  de respuesta, si el correo está registrado.
- **Cuenta bloqueada**: un usuario con `estado = bloqueado` no inicia sesión
  (responde `403 Cuenta bloqueada`).
- **El token se valida contra la base en cada petición**: la estrategia JWT
  (`backend/src/modules/auth/infrastructure/jwt/jwt.strategy.ts`) recarga el
  usuario y **recalcula sus permisos efectivos** en cada request. Si el usuario
  fue bloqueado o sus permisos cambiaron, el efecto es inmediato, sin esperar a
  que expire el token.

## 2. Política de contraseñas

Definida en `backend/src/modules/auth/domain/rules/password-policy.ts` y aplicada
a la creación, al restablecimiento y al cambio de contraseña propia:

- mínimo **12 caracteres**;
- máximo **72 bytes** (límite de bcrypt);
- se recortan los espacios en blanco al inicio y al final;
- el hash se genera con **bcrypt de 12 rondas**.

El seed del administrador aplica la misma política a `SEED_ADMIN_PASSWORD`.

## 3. Roles y permisos

Tres roles fijos sembrados (`backend/src/database/seed.ts`):

- **Admin**: usuario central, no pertenece a una sucursal (`sucursalId = null`).
- **Gerente**: pertenece a una sucursal y opera dentro de ella.
- **Empleado**: pertenece a una sucursal; puede recibir permisos individuales.

Cada permiso es una tupla `rol + permiso` (tabla `rol_permiso`). La matriz
completa sembrada es:

| Código                      | Descripción                              | Admin | Gerente | Empleado |
| --------------------------- | ---------------------------------------- | :---: | :-----: | :------: |
| `sucursales.crear_editar`   | Crear y editar sucursales                |   ✓   |         |          |
| `sucursales.ver`            | Ver sucursales                           |   ✓   |    ✓    |    ✓     |
| `usuarios.crear_editar`     | Crear y editar usuarios                  |   ✓   |    ✓    |          |
| `permisos.asignar`          | Asignar y revocar permisos               |   ✓   |    ✓    |          |
| `productos.catalogo.editar` | Editar el catálogo de productos          |   ✓   |         |          |
| `productos.precio.editar`   | Editar precios por sucursal              |       |    ✓    |          |
| `productos.ver`             | Ver productos                            |   ✓   |    ✓    |    ✓     |
| `insumos.catalogo.editar`   | Editar el catálogo de insumos            |   ✓   |         |          |
| `insumos.ver`               | Ver insumos                              |   ✓   |    ✓    |          |
| `inventario.registrar`      | Registrar movimientos de inventario      |   ✓   |    ✓    |          |
| `inventario.minimo.editar`  | Editar el stock mínimo                   |   ✓   |    ✓    |          |
| `inventario.recuento`       | Registrar recuentos                      |   ✓   |    ✓    |          |
| `alertas.ver_resolver`      | Ver y resolver alertas de stock          |   ✓   |    ✓    |          |
| `ventas.registrar`          | Registrar ventas                         |       |    ✓    |          |
| `ventas.anular`             | Anular ventas del día                    |   ✓   |    ✓    |    ✓     |
| `ventas.ver`                | Ver ventas                               |   ✓   |    ✓    |          |
| `equipo.registrar_editar`   | Registrar y editar equipos               |   ✓   |    ✓    |          |
| `equipo.ver`                | Ver equipos y su historial               |   ✓   |    ✓    |          |
| `reportes.comparativos.ver` | Ver reportes comparativos                |   ✓   |         |          |
| `empleados.crear_editar`    | Crear y editar empleados                 |   ✓   |    ✓    |          |
| `turnos.editar`             | Editar turnos y asignaciones             |   ✓   |    ✓    |          |
| `asistencia.marcar`         | Marcar entradas y salidas                |   ✓   |    ✓    |    ✓     |
| `asistencia.corregir`       | Corregir registros de asistencia         |       |    ✓    |          |
| `asistencia.ver`            | Ver registros de asistencia              |   ✓   |    ✓    |    ✓     |

Son **24 permisos**. Los 18 primeros tienen rutas implementadas; los 6 últimos
(`reportes.comparativos.ver`, `empleados.crear_editar`, `turnos.editar`,
`asistencia.*`) están sembrados pero **no tienen aún controladores**: pertenecen a
los módulos `reports`, `employees`, `shifts` y `attendance`, que son esqueletos.

## 4. Permisos individuales

Además del permiso que da el rol, un usuario puede tener permisos individuales en
`usuario_permiso` con tipo `concedido`/`revocado`:

- **Conceder**: el actor debe poseer el permiso entre sus efectivos. A un
  **Empleado** solo se le pueden conceder estos cuatro
  (`PERMISOS_CONCEDIBLES_A_EMPLEADO` en
  `backend/src/modules/users/domain/rules/reglas-permisos.ts`):

  - `insumos.ver`
  - `inventario.registrar`
  - `ventas.registrar`
  - `equipo.ver`

- **Revocar**: solo se puede revocar un permiso que el rol del objetivo tenga **por
  defecto**. Así un Empleado que es cajero no tiene `ventas.registrar` en su rol y
  se le concede individualmente; cuando deja de serlo se revoca.

Los permisos efectivos son la unión de los del rol más los individuales, con la
revocación anulando el correspondiente permiso de rol. Cada concesión/revocación
se registra en `historial_permisos` en la misma transacción.

## 5. Quién gestiona a quién (alcance)

- **Solo el Admin** gestiona a Administradores, y el Admin no pertenece a ninguna
  sucursal. Un Gerente solo gestiona **Empleados de su propia sucursal**; tocar un
  usuario fuera de su alcance responde `403`.
- Nadie puede modificar su propio rol o estado, ni asignarse/revocarse permisos a
  sí mismo.
- No se puede dejar al sistema **sin Admin activo**: se bloquea la operación que
  convertiría al último Admin activo en no activo o en otro rol.

## 6. Modelo de permisos por módulo

| Módulo      | Lectura                                   | Escritura                                     |
| ----------- | ----------------------------------------- | --------------------------------------------- |
| Sucursales  | `sucursales.ver`: Admin todas, resto la suya | `sucursales.crear_editar` (solo Admin). No hay borrado. |
| Usuarios    | `usuarios.crear_editar` (crear, listar, editar, estado, contraseña); permisos con `permisos.asignar`. | Ídem; el cambio de la propia contraseña solo exige autenticación. |
| Productos   | `productos.ver`                            | Catálogo: `productos.catalogo.editar` (Admin). Precio/estado por sucursal: `productos.precio.editar` (Gerente). |
| Inventario  | Insumos y stock: `insumos.ver`; movimientos: `inventario.registrar`; recuentos/alertas: `inventario.recuento` y `alertas.ver_resolver`. | Catálogo de insumos: `insumos.catalogo.editar` (Admin). Alta/stock mínimo/estado: `inventario.minimo.editar`. Entradas: `inventario.registrar`. Recuentos: `inventario.recuento`. |
| Ventas      | `ventas.ver` (Admin y Gerente)             | `ventas.registrar` (Gerente, o Empleado con concesión individual). Anulación: `ventas.anular`. |
| Equipos     | `equipo.ver`                               | `equipo.registrar_editar` (Admin y Gerente). |

## 7. Notas de verificación

- La matriz de esta sección se leyó del seed (`backend/src/database/seed.ts`), que
  es la fuente de verdad ejecutable.
- Los flujos de concesión/revocación se contrastaron con
  `reglas-permisos.ts` y su suite de pruebas.
- Los alcances por sucursal (responder `404` ante sucursal ajena, no `403`) se
  verifican en las reglas de cada módulo; el detalle por endpoint está en
  `docs/api/referencia-api.md`.
- Diferencia con la especificación original conocida: el permiso `equipo.ver` se
  sembra solo para Admin y Gerente (el Empleado lo obtiene únicamente mediante
  concesión individual). Cualquier otra discrepancia está registrada en
  `docs/architecture/decisiones-de-diseno.md`.