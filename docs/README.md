# Documentación técnica

Documentación del sistema Cafeteria System: un monorepo con una API REST
(NestJS + Prisma + PostgreSQL), un frontend aún por implementar y esta colección
de documentos.

## Índice

| Documento | Descripción |
| --------- | ----------- |
| [Guía de inicio](guides/guia-de-inicio.md) | Requisitos, base de datos, variables de entorno, migraciones, seed y servidor de desarrollo. |
| [Visión general de la arquitectura](architecture/vision-general.md) | Capas del backend, mapa de módulos y recorrido de una petición autenticada. |
| [Seguridad y permisos](architecture/seguridad-y-permisos.md) | Autenticación, roles, tabla de permisos sembrados y reglas de alcance por módulo. |
| [Modelo de datos](database/modelo-de-datos.md) | Entidades por dominio, enums, precisiones y reglas de integridad en la base. |
| [Referencia de la API](api/referencia-api.md) | Todas las rutas, su permiso, su alcance y los códigos de respuesta más comunes. |
| [Decisiones de diseño](architecture/decisiones-de-diseno.md) | Documento vivo con las decisiones, sus alternativas, consecuencias y discrepancias conocidas. |
| [Guía de pruebas](guides/pruebas.md) | Estrategia de pruebas, cómo ejecutarlas y qué cubre cada suite. |
| [Modelo de datos (DBML)](database/modelo.dbml) | Esquema fuente en lenguaje DBML, del que se genera `backend/prisma/schema.prisma`. |

## Cómo leer la documentación

- **Por rol de lector**: quien quiera levantar el proyecto en local empieza por la
  [guía de inicio](guides/guia-de-inicio.md); quien quiera entender cómo funciona
  el backend sigue la [visión general](architecture/vision-general.md) y la
  [referencia de la API](api/referencia-api.md); quien vaya a trabajar sobre datos
  o permisos lee el [modelo de datos](database/modelo-de-datos.md) y la
  [seguridad](architecture/seguridad-y-permisos.md).
- **Criterio de veracidad**: toda afirmación de estos documentos es verificable en
  el código, el esquema de Prisma, el seed o las pruebas. Aquello que no pudo
  comprobarse contra ellos está marcado como pendiente en la sección final de
  este índice.

## Módulos del backend

El backend vive en `backend/` y expone los siguientes módulos en
`backend/src/modules/`:

| Módulo      | Estado      | Descripción |
| ----------- | ----------- | ----------- |
| `auth`      | Implementado | Login JWT, límite de intentos y perfil propio. |
| `users`     | Implementado | Usuarios, roles y concesión/revocación de permisos individuales. |
| `branches`  | Implementado | Sucursales (crear, editar y consultar). |
| `products`  | Implementado | Catálogo global, categorías, variantes y precios por sucursal. |
| `inventory` | Implementado | Insumos, stock, entradas, recuentos, movimientos y alertas. |
| `sales`     | Implementado | Registro, consulta y anulación de ventas. |
| `equipment` | Implementado | Equipos por sucursal y su historial de estado. |
| `employees` | Esqueleto   | Archivos base (`controller`, `service`, `repository`) sin lógica. |
| `shifts`    | Esqueleto   | Archivos base sin lógica. |
| `attendance`| Esqueleto   | Módulo vacío; la tabla ya existe y es inmutable en la base. |
| `reports`   | Esqueleto   | Archivos base sin lógica. |

## Pendientes de verificar

Los siguientes puntos no pudieron confirmarse contra código, esquema o pruebas en
el momento de redactar esta documentación. No se afirmaron como ciertos:

- **Módulos `employees`, `shifts`, `attendance` y `reports`**: el esquema, el seed
  y una migración ya contienen tablas, enumeraciones, permisos y un trigger para
  estos dominios, pero su lógica de aplicación no está implementada. La
  documentación describe solo lo que existe en la base o en el seed, no un
  comportamiento de API que aún no existe.
- **Flujo operativo de asistencia y turnos**: los comportamientos de estos
  dominios (marcar entradas y salidas, corregir registros, asignar turnos,
  consultar horarios) no se pudieron contrastar con el código de aplicación, porque
  los módulos `attendance`, `shifts` y `employees` no tienen lógica implementada.
  Solo es verificable lo que ya existe en el esquema (entidades y enums de
  personal, el trigger de inmutabilidad de `registro_asistencia`) y en el seed
  (los permisos `asistencia.*` y `turnos.editar`).

### Discrepancias conocidas (código vs. especificación inicial)

Las diferencias entre lo que hace el código y lo que pedía la especificación
original están documentadas —y contrastadas contra el código— en
[Decisiones de diseño](architecture/decisiones-de-diseno.md), en la sección de
discrepancias. No se repiten aquí para evitar que el índice quede desactualizado
si se corrige el código.