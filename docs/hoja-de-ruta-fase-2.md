# Hoja de ruta — Fase 2

Mejoras previstas para una segunda fase, ordenadas por prioridad. **Cada punto proviene
de una limitación conocida o mejora futura ya documentada** en
[Decisiones de diseño](architecture/decisiones-de-diseno.md) (sección 17, limitaciones y
observaciones), [Frontend](frontend.md) (apartados «Sin soporte backend»), el
[README](../README.md) o la lista acordada para esta hoja de ruta. No se añaden mejoras
nuevas ni estimaciones de tiempo.

Lectura de cada ficha:

- **Qué es** — en una frase.
- **Por qué importa** — el problema o el riesgo que resuelve.
- **Alcance** — backend, frontend o ambos.

Las mejoras que **cambian una regla de negocio** están marcadas de forma explícita porque
requieren una decisión antes de implementarse (no son solo trabajo técnico).

## Prioridad alta

### 1. Invalidar tokens al cambiar la contraseña o añadir refresh tokens

- **Qué es:** que cambiar la contraseña invalide los tokens ya emitidos, o bien adoptar
  refresh tokens con revocación.
- **Por qué importa:** hoy cambiar la contraseña **no invalida los tokens vigentes**;
  siguen válidos hasta expirar (`JWT_EXPIRES_IN`, por defecto 8 h), y no hay token de
  refresco (limitación documentada en [Decisiones de diseño](architecture/decisiones-de-diseno.md)
  §3/§17 y en [Seguridad y permisos](seguridad-y-permisos.md) §1).
- **Alcance:** backend; el frontend si se añaden refresh tokens (renovación de sesión).

### 2. Límite de intentos de login persistente y compartido entre instancias

- **Qué es:** llevar los contadores de intentos fallidos de login desde la memoria del
  proceso a un almacén compartido (Redis o la base).
- **Por qué importa:** hoy viven en memoria, **se reinician al reiniciar el servidor** y
  **no se comparten entre instancias**, por lo que no protegen al escalar en horizontal
  (documentado en [Decisiones de diseño](architecture/decisiones-de-diseno.md) §17 y
  [guía de inicio](guia-de-inicio.md) §2).
- **Alcance:** backend.

### 3. Bitácora de seguridad de accesos

- **Qué es:** registrar eventos de seguridad (inicios de sesión y afines), no solo las
  operaciones de negocio.
- **Por qué importa:** la auditoría actual **excluye el login** y no cubre eventos de
  seguridad (documentado en el [README](../README.md) y en
  [Decisiones de diseño](architecture/decisiones-de-diseno.md) §14/§17).
- **Alcance:** ambos (el backend registra; el frontend podría consultarlo).

### 4. Idempotencia en ventas y recuentos

- **Qué es:** aceptar una clave de idempotencia en el `POST` de venta y en el de recuento.
- **Por qué importa:** hoy un doble envío crearía dos ventas o dos recuentos; se mitiga
  solo en el frontend deshabilitando el botón durante la petición (documentado en el
  [README](../README.md) y en [Decisiones de diseño](architecture/decisiones-de-diseno.md)
  §7/§17).
- **Alcance:** ambos (el backend admite la clave; el frontend la envía).

### 5. Playwright en el CI

- **Qué es:** ejecutar la suite de navegador (Playwright + axe) dentro de GitHub Actions.
- **Por qué importa:** hoy **no se ejecuta en CI** porque depende de servidores locales y
  de variables de entorno (`VERIF_ADMIN_PASSWORD` / `VERIF_DEMO_PASSWORD`); el workflow
  solo invoca backend y frontend (documentado en [Frontend](frontend.md) y
  [Estrategia de pruebas](estrategia-de-pruebas.md) §7).
- **Alcance:** frontend e integración continua.

### 6. Despliegue (Docker de producción, HTTPS, TRUST_PROXY y CORS_ORIGIN reales, copias de seguridad)

- **Qué es:** preparar el despliegue a producción: imagen/contenedor de producción, HTTPS,
  valores reales de `TRUST_PROXY` y `CORS_ORIGIN` y copias de seguridad.
- **Por qué importa:** `TRUST_PROXY` está **desactivado por defecto** y `CORS_ORIGIN`
  **vacía por defecto**; ambos deben configurarse correctamente detrás de un proxy
  (documentado en [guía de inicio](guia-de-inicio.md) §2) para no permitir saltar el
  límite de intentos ni bloquear al cliente legítimo.
- **Alcance:** ambos (infraestructura y configuración).

## Prioridad media

### 1. Ruta para listar usuarios vinculables a un empleado

- **Qué es:** exponer un endpoint que devuelva los usuarios candidatos a vincular al dar
  de alta un empleado.
- **Por qué importa:** el alta de empleado vincula un `usuarioId` existente, pero la API
  no ofrece una ruta para listar los candidatos (documentado en el [README](../README.md)).
- **Alcance:** ambos (nueva ruta en backend; selector en frontend).

### 2. Motivo y acta de baja y reactivación de empleados

- **Qué es:** guardar el motivo y un acta de baja al cesar a un empleado, y permitir
  reactivarlo.
- **Por qué importa:** el cese hoy fija la fecha y bloquea la cuenta pero **no guarda
  motivo ni acta**, y es **definitivo** (no hay ruta de reactivación) (documentado en el
  [README](../README.md)).
- **Alcance:** ambos (campos/ruta en backend; UI en frontend).

### 3. Permiso `turnos.ver` y vender sin `productos.ver`

- **Qué es:** separar la lectura de turnos de su edición (`turnos.ver`) y permitir
  registrar una venta cuando se tiene `ventas.registrar` pero no `productos.ver`.
- **Por qué importa:** hoy **no existe `turnos.ver`** (todo `/shifts` exige
  `turnos.editar`; ver [Seguridad y permisos](seguridad-y-permisos.md) §6 y
  [Decisiones de diseño](architecture/decisiones-de-diseno.md) §11), y la pantalla de
  venta no carga la carta sin `productos.ver` (documentado en [Frontend](frontend.md)
  y [Estrategia de pruebas](estrategia-de-pruebas.md)). Ajustar permisos **cambia reglas
  de acceso**, así que requiere decisión.
- **Alcance:** ambos (permisos/rutas en backend; menú y guards en frontend).

### 4. Exportación de reportes a CSV y PDF, comparativo contra el periodo anterior y nombres de insumos en alertas

- **Qué es:** exportar el reporte comparativo (CSV/PDF), compararlo con el periodo
  anterior y mostrar nombres de insumos en las alertas.
- **Por qué importa:** el reporte hoy **no exporta**, no trae deltas contra el periodo
  anterior ni producto más vendido, y las alertas/reportes muestran **solo conteos**, no
  nombres de insumos (documentado en [Frontend](frontend.md)).
- **Alcance:** ambos (datos/exportación en backend; botones y columnas en frontend).

### 5. Cobertura mínima por turno y cargo y tolerancia de tardanza

- **Qué es:** validar un mínimo de personal por turno y por cargo, y definir una
  tolerancia de tardanza.
- **Por qué importa:** hoy varios empleados pueden compartir un turno **sin límite** y no
  se valida un mínimo por turno ni por cargo; es una **mejora futura**, no una regla
  vigente (documentado en [Decisiones de diseño](architecture/decisiones-de-diseno.md) §17).
- **Alcance:** ambos (reglas en backend; avisos/validación en frontend).

### 6. Descuento de inventario por receta — cambia una regla de negocio

- **Qué es:** vincular la carta con los insumos mediante recetas para que una venta
  descuente inventario.
- **Por qué importa:** hoy **las ventas no descuentan inventario** y no hay recetas que
  relacionen producto e insumo; es un **requisito original** que se mantiene como está
  (documentado en [Decisiones de diseño](architecture/decisiones-de-diseno.md) §8);
  cambiarlo **modifica una regla de negocio** y requiere decisión.
- **Alcance:** ambos (regla y datos en backend; reflejo en frontend).

## Prioridad baja

### 1. OpenAPI utilizable y cliente generado

- **Qué es:** publicar un OpenAPI utilizable y generar un cliente tipado a partir de él.
- **Por qué importa:** hoy Swagger solo se expone cuando `NODE_ENV !== 'production'`
  (ver [guía de inicio](guia-de-inicio.md) y [Visión general](architecture/vision-general.md)
  §7) y el frontend usa un cliente escrito a mano ([Frontend](frontend.md)).
- **Alcance:** ambos (contrato en backend; cliente en frontend).

### 2. Filtro global de excepciones

- **Qué es:** un filtro global que dé formato uniforme a los errores.
- **Por qué importa:** está documentado como **a evaluar cuando el frontend lo requiera**
  ([Decisiones de diseño](architecture/decisiones-de-diseno.md) §17).
- **Alcance:** backend.

### 3. Tema oscuro revisado

- **Qué es:** revisar y cerrar el tema oscuro del sistema de diseño.
- **Por qué importa:** el tema oscuro está definido y con contraste verificado por cálculo
  ([Frontend](frontend.md)), pero conviene una revisión completa de pantallas antes de
  darlo por cerrado.
- **Alcance:** frontend.

### 4. Modo kiosco de la marcación

- **Qué es:** consolidar la marcación como un modo kiosco bloqueado.
- **Por qué importa:** el terminal ya es una pantalla completa tipo kiosco
  ([Frontend](frontend.md)); falta un modo que restrinja la navegación para su uso en un
  dispositivo dedicado.
- **Alcance:** frontend.

### 5. Datos personales del empleado (si el negocio lo pide)

- **Qué es:** incorporar datos personales del empleado al modelo y a la UI.
- **Por qué importa:** es una necesidad de negocio condicional; hoy el empleado se modela
  con los datos operativos actuales ([Modelo de datos](modelo-de-datos.md)).
- **Alcance:** ambos (modelo en backend; formularios en frontend), condicionado a la
  decisión del negocio.

### 6. Recuperación de contraseña y proveedores externos

- **Qué es:** recuperación de contraseña por correo e inicio de sesión con proveedores
  externos.
- **Por qué importa:** están previstos como **mejora futura**; en la Fase 1 no se envían
  correos y el identificador es el nombre de usuario
  ([Decisiones de diseño](architecture/decisiones-de-diseno.md) §4 y [Frontend](frontend.md)).
- **Alcance:** ambos (backend y frontend, más el envío de correo).

### 7. Formalizar el documento original de requisitos

- **Qué es:** formalizar y versionar el documento original de requisitos.
- **Por qué importa:** varias reglas se apoyan en un «requisito original» no versionado y
  otras quedan como **POR CONFIRMAR** por no tener requisito escrito
  ([docs/README](README.md) y [Decisiones de diseño](architecture/decisiones-de-diseno.md) §1).
- **Alcance:** documentación (sin cambios de código).
