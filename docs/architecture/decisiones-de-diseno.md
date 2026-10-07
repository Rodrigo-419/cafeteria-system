# Decisiones de diseño

## 1. Introducción

El sistema es una plataforma de gestión para una cadena de cafeterías con múltiples sucursales. Su propósito es centralizar la operación de cada sede: mantener un catálogo de productos y un inventario de insumos con alertas de reposición, registrar ventas por sucursal y controlar la anulación de esas ventas, administrar el equipamiento de cada local, y gestionar los usuarios, roles y permisos que operan el sistema. También contempla un bloque de gestión de personal (empleados, turnos y asistencia) que está en diseño y aún no se implementa.

El backend se construye como un monolito modular en **NestJS 12** con **TypeScript**, usando **Prisma 7** (con el adapter `@prisma/adapter-pg`) como ORM y **PostgreSQL 17** en contenedor Docker. El repositorio es un monorepo que organiza el backend (`backend/`), un frontend aún sin desarrollar (`frontend/`, solo como espacio reservado), la documentación técnica (`docs/`) y la infraestructura (`docker-compose.yml`). La API expone sus rutas bajo el prefijo `/api` y se documenta con Swagger en `/api/docs`, disponible solo fuera de producción. Las pruebas del backend incluyen pruebas unitarias, pruebas end-to-end contra una base de datos aparte y un pipeline de integración continua en GitHub Actions.

Este documento recoge las decisiones de diseño tomadas a lo largo del proyecto, organizadas por módulo, junto con las limitaciones conocidas y las discrepancias detectadas entre la especificación y la implementación real.

## 2. Decisiones generales

- Se opta por un **monolito modular de NestJS 12 con TypeScript**, con Prisma 7 (adapter pg) y PostgreSQL 17 en Docker. Los módulos con lógica real (auth, users, sales, inventory y attendance) implementan las capas completas (presentation, application, domain e infrastructure); los demás usan una estructura más liviana.
- Los identificadores se generan como **UUID v7**. Las fechas se guardan en UTC y la zona horaria de negocio es **America/Lima** para determinar el "mismo día".
- Todas las rutas viven bajo el prefijo `/api`. Swagger se publica en `/api/docs` únicamente cuando no se ejecuta en producción.
- Un **recurso fuera del alcance del usuario responde 404** (no se revela que existe); la **falta de permiso responde 403**. Las reglas de alcance son deny-by-default: un rol desconocido no accede a nada.
- El **dinero se maneja con Decimal** (en el dominio se trabaja en céntimos enteros) y se devuelve como string con 2 decimales; el **stock se almacena en `Decimal(12,2)`**.
- No hay **borrado físico en las entidades con historial**; las claves foráneas usan `onDelete: Restrict`. La auditoría queda registrada en `historial_permisos`, `historial_equipo` y `movimiento_inventario`.
- Parte de las **reglas de integridad viven en la base de datos** (migración propia): un trigger hace inmutable la tabla `registro_asistencia`, un índice único parcial permite solo una alerta de stock abierta por insumo y sucursal, y existen CHECKs de coherencia (anulación de ventas, resolución de alertas, correcciones de asistencia) y de valores no negativos.
- Las **variables de entorno se validan con zod** al arrancar la aplicación; los secretos nunca se versionan.
- Calidad: las **pruebas unitarias no tocan la base de datos**, las **pruebas end-to-end corren contra una base aparte** (`cafeteria_test`) y se **abortan si el nombre de la base no termina en `_test`**, y hay **CI en GitHub Actions** que ejecuta build, lint y las pruebas unitarias.

## 3. Módulo Auth

- El login emite un **JWT de acceso de 8 horas**, sin token de refresco (su incorporación está prevista como mejora futura).
- El endpoint de login tiene un **límite de 5 intentos por minuto por IP** (guarda de throttling).
- Los **permisos efectivos (rol + concedidos − revocados) se calculan en cada petición**, recargándolos desde la base de datos. Así, bloquear a un usuario o cambiarle los permisos surte efecto de inmediato, sin esperar a que expire el token.
- Ante **credenciales inválidas se responde siempre el mismo mensaje y en un tiempo equivalente** para correo inexistente y contraseña errónea, de modo que el login no revela si un correo está registrado (se compara contra un hash falso cuando el usuario no existe).
- La **contraseña** exige un mínimo de 12 caracteres y un máximo de 72 bytes (el límite de bcrypt); el hashing usa **bcryptjs con 12 rondas**.
- Limitación conocida: **cambiar una contraseña no invalida los tokens ya emitidos**; siguen válidos hasta que expiren.

## 4. Módulo Users

- La **contraseña inicial la escribe quien crea el usuario** y se la entrega en persona; por ahora **no hay envío de correos**.
- El **Admin gestiona a cualquier usuario**. El **Gerente gestiona solo a Empleados de su sucursal** (la sucursal se fuerza a la suya, ignorando la que se envíe). El **Admin no tiene sucursal** asignada.
- **Nadie modifica su propio rol, estado ni permisos**; el **último Admin activo no se puede bloquear** ni dejar de ser Admin.
- Los permisos individuales tienen reglas estrictas: **solo se puede conceder un permiso que se posee**; a un Empleado solo se le pueden conceder `insumos.ver`, `inventario.registrar`, `ventas.registrar` y `equipo.ver`; la **revocación puede aplicarse a cualquier permiso propio del rol** del usuario objetivo. Cada cambio se registra en `historial_permisos` **en la misma transacción**.
- **Listar y consultar usuarios usa el permiso `usuarios.crear_editar`** (la matriz de permisos no tiene `usuarios.ver`; se reutiliza el permiso de edición para leer). Si un Gerente intenta **cambiar el rol o la sucursal** de un empleado que sí está en su alcance, recibe **403**: el recurso es visible, lo que se rechaza es la operación.

## 5. Módulo Branches

- **Solo el Admin crea y edita sucursales** (permiso `sucursales.crear_editar`). **No se borran**.
- El **nombre de sucursal es único ignorando mayúsculas y espacios sobrantes** (se recorta, se colapsan los espacios internos y se pasa a minúsculas para comparar).
- **Gerente y Empleado solo ven su propia sucursal**; cualquier otra responde 404.

## 6. Módulo Products

- El **catálogo global (categorías, productos, variantes) solo lo edita el Admin** (permiso `productos.catalogo.editar`). El **precio y la disponibilidad por sucursal solo los cambia el Gerente sobre su sucursal** (permiso `productos.precio.editar`); el **Admin recibe 403** en esa operación porque su rol no tiene ese permiso, y el Gerente sobre otra sucursal recibe 404.
- La variante **"Única" es la base del sistema** (representa el producto sin tamaños) y **no se renombra ni se elimina** (409).
- Los **borrados con dependencias responden 409**; la forma correcta de retirar un producto o una oferta es **desactivarlo en la sucursal** (`estado: "inactivo"`). **No hay DELETE de ofertas**.
- El **nombre del producto es único dentro de su categoría** (se valida en el servicio, tanto al crear como al cambiar nombre o categoría). El **precio debe estar entre 0.01 y 100000 con 2 decimales** como máximo.
- El **Empleado solo ve ofertas activas** en la carta; Admin y Gerente ven activas e inactivas.

## 7. Módulo Inventory

- Los **insumos son globales y solo los edita el Admin** (permiso `insumos.catalogo.editar`). **Darlos de alta en una sucursal y fijar el stock mínimo** usa el permiso `inventario.minimo.editar` (el Admin en cualquier sucursal, el Gerente solo en la suya).
- El **stock solo cambia por entradas (cantidad mayor que 0) y por recuentos**; no hay ajuste manual. El stock **nunca queda negativo**.
- Un **recuento puede ser parcial**, **bloquea las filas que cuenta**, guarda el stock del sistema, el stock físico y la diferencia, y **iguala el stock al físico con un movimiento de ajuste** dentro de la misma transacción.
- Las **alertas de stock son automáticas**: se abren cuando el stock queda en o por debajo del mínimo y **se resuelven solas** al superarlo. **No hay resolución manual**, precisamente para evitar que una alerta resuelta a mano se reabra sola o pierda sincronía con un stock ya repuesto.
- Un **insumo descontinuado no genera alertas ni admite movimientos** (una entrada o un recuento responden 409).
- Los **recuentos son solo de Admin y Gerente** (permiso `inventario.recuento`). El **empleado reponedor** (al que se le concedieron `insumos.ver` e `inventario.registrar`) **solo registra entradas**.

## 8. Módulo Sales

- El **"mismo día" se calcula en America/Lima**, no en UTC (la zona horaria de negocio define el cierre de caja).
- **Las ventas no descuentan inventario**: el esquema no tiene recetas que relacionen productos con insumos, así que la venta no afecta al stock.
- El **precio se congela en cada línea** (`precio_unitario_snapshot`); el **subtotal y el total los calcula el servidor** en céntimos exactos y **el cliente nunca los envía**.
- **Solo se venden ofertas activas de la sucursal de quien vende** (una oferta inexistente o de otra sucursal responde 404; una inactiva, 409). La venta admite **de 1 a 50 líneas**, con **cantidad entera de 1 a 100** y **sin líneas repetidas** de la misma oferta. El **método de pago** (efectivo o tarjeta) **es solo un registro**; no se procesa ningún pago real.
- **Anular exige un motivo de 3 a 200 caracteres**: el **Gerente anula cualquier venta de su sucursal** y el **Empleado solo las propias**, siempre **dentro del mismo día**; anular no borra, cambia el estado de la venta a `anulada` registrando quién, cuándo y por qué. Las **ventas son inmutables** una vez anuladas (no se anulan dos veces).
- **El Admin consulta ventas pero no registra ni anula** (su rol solo tiene `ventas.ver`). El **Empleado no tiene `ventas.ver`** (puede registrar y anular las propias, pero no consultar el histórico).

## 9. Módulo Equipment

- **El Admin gestiona equipos de cualquier sucursal**; el **Gerente solo los de la suya** (la sucursal se fuerza a la propia). Para **ver**: el Admin ve todos, el Gerente los suyos, y el **Empleado solo ve equipos si se le concede el permiso individual `equipo.ver`** (entonces solo los de su sucursal).
- Estados posibles: **funcionando, dañado, en mantenimiento y retirado**; el estado **"retirado" es terminal** (no admite cambios de estado posteriores).
- El **historial se genera solo al cambiar el estado o las observaciones** (no al cambiar el nombre). Los **equipos no se borran** y se **permiten nombres repetidos** (no hay unicidad de nombre).

## 10. Bloque de personal (en diseño)

Aún no implementado: el esquema de datos ya contempla las tablas y reglas de integridad (inmutabilidad de `registro_asistencia`, CHECKs de correcciones), pero no existe la API. Las decisiones previstas son:

- **Los horarios varían y no hay marcación con tarjeta**: cada persona marca su entrada y su salida **desde el sistema con su propio usuario**.
- Existen **turnos fijos** para empleados con horario definido (permiten calcular tardanzas y faltas) y **turnos variables** para quienes tienen horario flexible (solo se registran horas trabajadas).
- El **Gerente puede justificar faltas de su sucursal** y **registrar a mano una marca olvidada con motivo**.
- Se contempla una **tolerancia de tardanza de 10 minutos** y el **manejo de turnos que cruzan la medianoche**.
- **Sin nómina ni horas extra** en este alcance.

## 11. Limitaciones conocidas y mejoras futuras

- **Refresh token con rotación**: hoy solo hay token de acceso sin renovación.
- **Envío de correos** para las contraseñas iniciales (hoy la entrega es manual).
- **Consumo de insumos mediante recetas**: vincular productos con insumos para que las ventas descuenten inventario.
- **Idempotency-Key en el registro de ventas**: evitar ventas duplicadas ante reintentos de red.
- **Ejecutar las pruebas end-to-end en GitHub Actions** (hoy el CI solo corre build, lint y unitarias).
- **Configurar `trust proxy` al desplegar** detrás de un proxy inverso.
- **Ajustar el límite de intentos de login** cuando se opera detrás de un proxy, para que la limitación por IP funcione correctamente.

## 12. Discrepancias detectadas

Durante la verificación de este documento contra el código y las pruebas reales se detectaron las siguientes diferencias. No se corrigió el código: se registran aquí para conocimiento:

- **Límites de líneas y cantidades en ventas** (módulo Sales). El texto de este documento dice "de 1 a 50 líneas, cantidad entera de 1 a 100", pero la implementación permite **hasta 100 líneas** (`MAXIMO_LINEAS_VENTA = 100` en `backend/src/modules/sales/domain/rules/lineas-venta.ts`) y **cantidades de 1 a 9999** (`MINIMO_CANTIDAD = 1`, `MAXIMO_CANTIDAD = 9999` en el mismo archivo, aplicados también en el DTO `backend/src/modules/sales/presentation/dto/sales.dto.ts`). Diferencia: los límites reales son 100 líneas y cantidades de 1 a 9999.
- **Motivo de anulación: mínimo de caracteres** (módulo Sales). Este documento dice "motivo de 3 a 200 caracteres", pero el DTO solo exige un mínimo de **1 carácter** (`@MinLength(1)` en `backend/src/modules/sales/presentation/dto/sales.dto.ts`) y el caso de uso rechaza únicamente el motivo vacío tras recortarlo (`anular-venta.use-case.ts`). El máximo de 200 sí coincide. Diferencia: el mínimo real es 1 carácter con contenido.
- **Representación del estado "dañado" del equipo** (módulo Equipment). El texto de este documento usa la forma acentuada "dañado", pero el valor almacenado en el enum es **`danado` sin tilde** (`backend/src/modules/equipment/domain/rules/equipment.rules.ts` y enum `EquipoEstado` del esquema Prisma). Diferencia: representación interna del valor, no de comportamiento.