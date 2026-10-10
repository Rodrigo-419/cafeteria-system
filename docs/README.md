# Documentación técnica

Documentación del sistema Cafeteria System: un monorepo con una API REST
(NestJS + Prisma + PostgreSQL), un frontend aún por implementar y esta colección
de documentos.

## Índice

| Documento | Ruta | Descripción |
| --------- | ---- | ----------- |
| [Guía de inicio](guia-de-inicio.md) | `docs/guia-de-inicio.md` | Requisitos, base de datos, variables de entorno, migraciones, seed y servidor de desarrollo. |
| [Visión general de la arquitectura](architecture/vision-general.md) | `docs/architecture/vision-general.md` | Capas del backend, mapa de módulos y recorrido de una petición autenticada. |
| [Seguridad y permisos](seguridad-y-permisos.md) | `docs/seguridad-y-permisos.md` | Autenticación, roles, tabla de permisos sembrados y reglas de alcance por módulo. |
| [Modelo de datos](modelo-de-datos.md) | `docs/modelo-de-datos.md` | Entidades por dominio, enums, precisiones y reglas de integridad en la base. |
| [Referencia de la API](referencia-api.md) | `docs/referencia-api.md` | Todas las rutas, su permiso, su alcance y los códigos de respuesta más comunes. |
| [Decisiones de diseño](architecture/decisiones-de-diseno.md) | `docs/architecture/decisiones-de-diseno.md` | Documento vivo con las reglas de negocio por módulo (tablas), supuestos a confirmar y pendientes. |
| [Estrategia de pruebas](estrategia-de-pruebas.md) | `docs/estrategia-de-pruebas.md` | Estrategia de pruebas, cifras actuales, cómo ejecutarlas y qué cubre cada suite. |
| [Modelo de datos (DBML)](database/modelo.dbml) | `docs/database/modelo.dbml` | Esquema fuente en lenguaje DBML, del que se genera `backend/prisma/schema.prisma`. |

## Cómo leer la documentación

- **Por rol de lector**: quien quiera levantar el proyecto en local empieza por la
  [guía de inicio](guia-de-inicio.md); quien quiera entender cómo funciona el
  backend sigue la [visión general](architecture/vision-general.md) y la
  [referencia de la API](referencia-api.md); quien vaya a trabajar sobre datos o
  permisos lee el [modelo de datos](modelo-de-datos.md) y la
  [seguridad](seguridad-y-permisos.md).
- **Criterio de veracidad**: toda afirmación de estos documentos es verificable en
  el código, el esquema de Prisma, el seed o las pruebas. Aquello que no pudo
  comprobarse contra ellos está marcado como pendiente en la sección final de
  este índice o con el estado **POR CONFIRMAR** en las tablas de
  [decisiones de diseño](architecture/decisiones-de-diseno.md).

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
| `employees` | Implementado | Empleados vinculados a un usuario, cargo, cese y PIN de marcación. |
| `shifts`    | Implementado | Turnos fijos/variables y asignaciones con control de solapamiento. |
| `attendance`| Implementado | Marcación con PIN, correcciones, faltas justificadas y lecturas. |
| `reports`   | Esqueleto   | Archivos base sin lógica. |

## Pendientes de verificar

Los siguientes puntos no pudieron confirmarse contra código, esquema o pruebas en
el momento de redactar esta documentación. No se afirmaron como ciertos:

- **Módulo `reports`**: el seed ya siembra su permiso
  (`reportes.comparativos.ver`) y el esquema puede contener tablas afines, pero la
  lógica de aplicación **no está implementada**. La documentación describe solo lo
  que existe en la base o en el seed, no un comportamiento de API que aún no
  existe. Los módulos `employees`, `shifts` y `attendance` **sí** están
  implementados (ver [Referencia de la API](referencia-api.md) y
  [Decisiones de diseño](architecture/decisiones-de-diseno.md)).

### Supuestos a confirmar

Las reglas que se asumieron durante el diseño y que hoy no tienen requisito
escrito, ni constraint en la base ni prueba dedicada están listadas —con su
estado **Confirmada / POR CONFIRMAR**— en la sección [inventario de supuestos
clave](architecture/decisiones-de-diseno.md#13-inventario-de-supuestos-clave-resumen)
de Decisiones de diseño.

### Discrepancias conocidas (código vs. especificación inicial)

Las diferencias entre lo que hace el código y lo que pedía la especificación
original están documentadas —y contrastadas contra el código— en
[Decisiones de diseño](architecture/decisiones-de-diseno.md), en su sección de
limitaciones y observaciones. No se repiten aquí para evitar que el índice quede
desactualizado si se corrige el código.