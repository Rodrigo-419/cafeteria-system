// Tipos del contrato de la API. Se declaran solo los campos que el frontend
// consume: la tipacion estructural de TypeScript tolera los campos extra que el
// backend pueda anadir, de modo que no hay que duplicar cada DTO.

/** Usuario autenticado tal como lo devuelven `POST /auth/login` y `GET /auth/me`. */
export interface UsuarioApi {
  id: string
  nombre: string
  nombreUsuario: string
  rol: string | null
  sucursalId: string | null
  /** Permisos efectivos (rol + concedidos - revocados). */
  permisos: string[]
}

/** Respuesta de `POST /api/auth/login`. */
export interface RespuestaLogin {
  accessToken: string
  tokenType: string
  /** Segundos de vigencia del token. */
  expiresIn: number
  user: UsuarioApi
}

/** Métodos de pago admitidos por el backend (solo registro). */
export type MetodoPagoVenta = 'efectivo' | 'tarjeta'

/** Estados posibles de una venta. */
export type EstadoVenta = 'completada' | 'anulada'

/** Estados de una oferta de la carta. */
export type EstadoOferta = 'activo' | 'inactivo'

/** Una oferta de la carta de una sucursal (`GET /branches/:id/products`). */
export interface CartaOferta {
  id: string
  productoId: string
  varianteId: string
  /** Precio decimal como texto ("12.50"). */
  precio: string
  estado: EstadoOferta
  producto: {
    id: string
    nombre: string
    categoriaId: string
    categoria: { id: string; nombre: string }
  }
  variante: { id: string; nombre: string }
}

/** Una línea de una venta, con el precio congelado en el momento de vender. */
export interface DetalleVentaApi {
  id: string
  productoSucursalVarianteId: string
  cantidad: number
  /** Precio unitario congelado como texto ("12.50"). */
  precioUnitario: string
  /** Subtotal de la línea como texto ("25.00"). */
  subtotal: string
  producto: { id: string; nombre: string }
  variante: { id: string; nombre: string }
}

/** Una venta resumida (listado) o completa (con `detalles`). */
export interface VentaApi {
  id: string
  sucursalId: string
  usuarioId: string
  metodoPago: MetodoPagoVenta
  estado: EstadoVenta
  fechaAnulacion: string | null
  usuarioAnuladorId: string | null
  motivoAnulacion: string | null
  createdAt: string
  updatedAt: string
  sucursal: { id: string; nombre: string }
  vendedor: { id: string; nombre: string }
  anulador: { id: string; nombre: string } | null
  /** Día de negocio en America/Lima ("AAAA-MM-DD"). */
  fecha: string
  /** Total como texto ("25.00"). */
  total: string
  /** Número de líneas de la venta. */
  lineas: number
}

/** Venta con sus líneas (`GET /sales/:id` y respuestas de registrar/anular). */
export interface VentaCompletaApi extends VentaApi {
  detalles: DetalleVentaApi[]
}

/** Sobre de paginado compartido por los listados. */
export interface PaginadoApi<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPaginas: number
}

/** Una sucursal (`GET /branches`). */
export interface SucursalApi {
  id: string
  nombre: string
  direccion: string
  telefono: string | null
}

/** Estado de una alerta de stock (`GET /inventario/alertas`). */
export type EstadoAlertaStock = 'abierta' | 'resuelta'

/**
 * Alerta de stock con el insumo y el stock en el momento de la consulta
 * (`GET /inventario/alertas`).
 */
export interface AlertaStockApi {
  id: string
  insumoSucursalId: string
  estado: EstadoAlertaStock
  fechaResuelta: string | null
  createdAt: string
  updatedAt: string
  insumoSucursal: {
    id: string
    insumoId: string
    sucursalId: string
    /** Stock actual decimal como texto ("12.50"). */
    stockActual: string
    /** Stock mínimo decimal como texto ("5.00"). */
    stockMinimo: string
    estado: string
    insumo: { id: string; nombre: string; presentacion: string }
  }
}

/** Registro efectivo de asistencia (`GET /attendance/records`). */
export interface RegistroAsistenciaApi {
  id: string
  empleadoId: string
  sucursalId: string
  /** "entrada" o "salida". */
  tipo: string
  fechaHora: string
  metodo: string
  /** `true` si la entrada sigue sin cerrar (sin salida emparejada). */
  abierta: boolean
  corregido: boolean
  empleado: { id: string; nombre: string }
}

/** Sobre de paginado propio de asistencia (`items` en vez de `data`). */
export interface PaginadoAsistenciaApi<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

/** Estados posibles de un equipo (`GET /equipment`). */
export type EstadoEquipo =
  | 'funcionando'
  | 'danado'
  | 'en_mantenimiento'
  | 'retirado'

/** Un equipo de una sucursal (`GET /equipment`). */
export interface EquipoApi {
  id: string
  sucursalId: string
  nombre: string
  tipo: string
  estado: EstadoEquipo
  observaciones: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Registro del historial de un equipo (`GET /equipment/:id/history`). Solo se
 * crea cuando cambian el estado o las observaciones; incluye los valores
 * anteriores, el autor y la fecha.
 */
export interface HistorialEquipoApi {
  id: string
  equipoId: string
  estadoAnterior: EstadoEquipo
  estadoNuevo: EstadoEquipo
  observacionesAnterior: string | null
  observacionesNuevas: string | null
  usuarioId: string
  createdAt: string
  usuario: { id: string; nombre: string } | null
}

// -------------------------------------------------------------- empleados

/** Estado de un empleado: `activo` o `inactivo` (cesado). Un cese no borra. */
export type EstadoEmpleado = 'activo' | 'inactivo'

/**
 * Empleado vinculado a un usuario existente (`GET /employees`). El hash del PIN
 * nunca se incluye y el backend no expone si el empleado ya tiene PIN.
 */
export interface EmpleadoApi {
  id: string
  usuarioId: string
  cargo: string
  sucursalId: string
  /** Día de contratación (ISO/UTC a medianoche). */
  fechaContratacion: string
  fechaCese: string | null
  estado: EstadoEmpleado
  createdAt: string
  updatedAt: string
  usuario: { id: string; nombre: string; nombreUsuario: string; rol: string }
}

/**
 * Respuesta de `POST /employees/:id/pin`: el PIN en claro se entrega una sola
 * vez y no vuelve a estar disponible. No debe guardarse en caché ni en el
 * navegador.
 */
export interface PinEmpleadoApi {
  pin: string
}

// ------------------------------------------------------------------ turnos

/**
 * Tipo de turno: `fijo` (con hora de inicio/fin y días de la semana) o
 * `variable` (sin horario fijo, para refuerzos). El tipo y la sucursal no se
 * cambian después del alta.
 */
export type TipoTurno = 'fijo' | 'variable'

/** Un turno de una sucursal (`GET /shifts`). */
export interface TurnoApi {
  id: string
  sucursalId: string
  tipo: TipoTurno
  /** Hora "HH:mm" o `null` si el turno no tiene franja. */
  horaInicio: string | null
  horaFin: string | null
  /** Días ISO 1-7 separados por comas ("1,2,3") o `null`. */
  diasSemana: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Asignación de un turno a un empleado (`GET /assignments`). Se retira fijando
 * `fechaFin`: no existe borrado de asignaciones.
 */
export interface AsignacionApi {
  id: string
  empleadoId: string
  turnoId: string
  /** Día de inicio (ISO/UTC a medianoche). */
  fechaInicio: string
  /** Día de fin (ISO/UTC a medianoche); `null` mientras siga vigente. */
  fechaFin: string | null
  createdAt: string
  updatedAt: string
  empleado: {
    id: string
    cargo: string
    sucursalId: string
    usuario: { id: string; nombre: string; nombreUsuario: string }
  }
  turno: TurnoApi
}

/** Importes por método de pago del reporte comparativo. */
export interface ReporteVentasMetodoApi {
  /** Importe en texto con dos decimales. */
  total: string
  cantidad: number
}

/** Ventas de una sucursal en el periodo del reporte comparativo. */
export interface ReporteVentasApi {
  total: string
  cantidad: number
  /** `null` cuando no hubo ventas en el periodo. */
  ticketPromedio: string | null
  porMetodoPago: {
    efectivo: ReporteVentasMetodoApi
    tarjeta: ReporteVentasMetodoApi
  }
  anuladas: { cantidad: number }
}

/** Una fila del reporte comparativo entre sucursales. */
export interface ReporteSucursalApi {
  sucursalId: string
  sucursalNombre: string
  ventas: ReporteVentasApi
  inventario: {
    movimientos: {
      total: number
      entradas: { cantidad: number; cantidadNeta: string }
      ajustes: { cantidad: number; cantidadNeta: string }
    }
  }
  asistencia: { faltas: number; faltasJustificadas: number }
  estadoActual: { insumosConAlertaAbierta: number; entradasAbiertas: number }
}

/** Respuesta de `GET /reports/comparativo`. */
export interface ReporteComparativoApi {
  desde: string
  hasta: string
  /** Instante ISO en el que se generó el reporte. */
  generadoEn: string
  sucursales: ReporteSucursalApi[]
}

/** Una categoría del catálogo global (`GET /product-categories`). */
export interface CategoriaProductoApi {
  id: string
  nombre: string
  createdAt: string
  updatedAt: string
}

/** Una variante del catálogo global (`GET /variants`). */
export interface VarianteApi {
  id: string
  nombre: string
  createdAt: string
  updatedAt: string
}

/** Un producto del catálogo global (`GET /products`), con su categoría. */
export interface ProductoApi {
  id: string
  nombre: string
  categoriaId: string
  descripcion: string | null
  createdAt: string
  updatedAt: string
  categoria: { id: string; nombre: string }
}

/** Respuesta del upsert de una oferta de sucursal (precio y estado). */
export interface OfertaRespuestaApi {
  /** Precio decimal como texto ("12.50"). */
  precio: string
  estado: EstadoOferta
}

// ------------------------------------------------------------------ insumos

/**
 * Presentación cerrada de un insumo: es la lista que acepta el backend para
 * `presentacion` (cualquier otro valor responde 400).
 */
export type PresentacionInsumo =
  | 'paquete'
  | 'bolsa'
  | 'caja'
  | 'unidad'
  | 'paquete_varias_unidades'

/** Estado de un insumo dentro de una sucursal. */
export type EstadoStockInsumo = 'activo' | 'descontinuado'

/** Un insumo del catálogo global (`GET /insumos`). */
export interface InsumoApi {
  id: string
  nombre: string
  presentacion: PresentacionInsumo
  createdAt: string
  updatedAt: string
}

/**
 * Stock de un insumo en una sucursal
 * (`GET /inventario/sucursales/:sucursalId/stock`). Las cantidades llegan como
 * texto decimal ("12.50").
 */
export interface StockInsumoApi {
  id: string
  insumoId: string
  sucursalId: string
  stockActual: string
  stockMinimo: string
  estado: EstadoStockInsumo
  createdAt: string
  updatedAt: string
  insumo: InsumoApi
}

/** Tipo de un movimiento de stock. */
export type TipoMovimientoInventario = 'entrada' | 'ajuste'

/** Un movimiento de inventario: la cantidad es la variación, no el saldo. */
export interface MovimientoInventarioApi {
  id: string
  insumoSucursalId: string
  tipo: TipoMovimientoInventario
  /** Variación decimal como texto; puede ser negativa en ajustes. */
  cantidad: string
  usuarioId: string
  motivo: string
  createdAt: string
}

/** Respuesta de registrar una entrada: stock actualizado + movimiento. */
export interface ResultadoEntradaApi {
  stock: StockInsumoApi
  movimiento: MovimientoInventarioApi
}

/** Línea de un recuento con el stock de sistema, el contado y la diferencia. */
export interface LineaRecuentoApi {
  id: string
  recuentoId: string
  insumoSucursalId: string
  stockSistema: string
  stockFisico: string
  diferencia: string
  createdAt: string
  insumoSucursal: StockInsumoApi
}

/** Cabecera de un recuento (`GET /inventario/recuentos`). */
export interface RecuentoApi {
  id: string
  sucursalId: string
  usuarioId: string
  createdAt: string
}

/** Recuento con sus líneas, el usuario y la sucursal (`GET /recuentos/:id`). */
export interface RecuentoDetalleApi extends RecuentoApi {
  usuario: { id: string; nombre: string }
  sucursal: { id: string; nombre: string }
  detalles: LineaRecuentoApi[]
}

// --------------------------------------------------------------- usuarios

/** Estado de un usuario (`activo` o `bloqueado`). */
export type EstadoUsuario = 'activo' | 'bloqueado'

/**
 * Usuario gestionable (`GET /users` y respuestas de crear/editar/estado). No
 * incluye `permisos`: esos se consultan por separado en `GET /users/:id/permisos`.
 */
export interface UsuarioGestionApi {
  id: string
  nombre: string
  nombreUsuario: string
  rol: string
  sucursalId: string | null
  estado: EstadoUsuario
  createdAt: string
  updatedAt: string
}

/** Origen de cada permiso efectivo devuelto por `GET /users/:id/permisos`. */
export type OrigenPermiso = 'rol' | 'concedido' | 'revocado'

/**
 * Permiso efectivo de un usuario (`GET /users/:id/permisos`). El backend solo
 * devuelve los permisos que el rol del objetivo otorga por defecto más las
 * asignaciones individuales (concedidas o revocadas): no expone el catálogo
 * completo de permisos, por lo que la interfaz solo puede actuar sobre lo que
 * aquí aparezca.
 */
export interface PermisoEfectivoApi {
  permisoId: string
  codigo: string
  descripcion: string
  origen: OrigenPermiso
  /** `false` solo cuando el permiso está revocado individualmente. */
  efectivo: boolean
}

// ------------------------------------------------------------- auditoría

/**
 * Entidad auditada (`auditoria_entidad`). El backend la envía como texto, por
 * lo que se declara como unión cerrada para tipar los filtros pero con acceso
 * por índice en los mapas de etiquetas.
 */
export type EntidadAuditoria =
  | 'usuario'
  | 'empleado'
  | 'sucursal'
  | 'categoria'
  | 'variante'
  | 'producto'
  | 'oferta'
  | 'insumo'
  | 'insumo_sucursal'
  | 'turno'
  | 'asignacion'
  | 'equipo'

/**
 * Acción auditada (`auditoria_accion`, 44 valores). Igual que con las
 * entidades: unión cerrada para los filtros, acceso libre en los mapas.
 */
export type AccionAuditoria =
  | 'usuario_creado'
  | 'usuario_editado'
  | 'usuario_rol_cambiado'
  | 'usuario_sucursal_cambiada'
  | 'usuario_bloqueado'
  | 'usuario_activado'
  | 'usuario_password_restablecida'
  | 'usuario_password_cambiada'
  | 'permiso_concedido'
  | 'permiso_revocado'
  | 'permiso_restablecido'
  | 'empleado_creado'
  | 'empleado_editado'
  | 'empleado_cesado'
  | 'empleado_pin_regenerado'
  | 'sucursal_creada'
  | 'sucursal_editada'
  | 'categoria_creada'
  | 'categoria_editada'
  | 'categoria_eliminada'
  | 'variante_creada'
  | 'variante_editada'
  | 'variante_eliminada'
  | 'producto_creado'
  | 'producto_editado'
  | 'producto_eliminado'
  | 'oferta_creada'
  | 'oferta_precio_fijado'
  | 'oferta_activada'
  | 'oferta_desactivada'
  | 'insumo_creado'
  | 'insumo_editado'
  | 'insumo_eliminado'
  | 'insumo_sucursal_creado'
  | 'insumo_sucursal_stock_minimo_cambiado'
  | 'insumo_sucursal_activado'
  | 'insumo_sucursal_descontinuado'
  | 'turno_creado'
  | 'turno_editado'
  | 'asignacion_creada'
  | 'asignacion_retirada'
  | 'equipo_creado'
  | 'equipo_editado'
  | 'equipo_estado_cambiado'

/**
 * Detalle semántico de un evento. El backend lo sanitiza antes de persistirlo
 * (nunca incluye contraseñas ni PIN) y lo envía como `{ antes?, despues? }`
 * con un par clave/valor por campo cambiado.
 */
export interface DetalleAuditoriaApi {
  antes?: Record<string, unknown> | null
  despues?: Record<string, unknown> | null
}

/** Un evento del log de auditoría (`GET /api/auditoria`). */
export interface EventoAuditoriaApi {
  id: string
  entidad: EntidadAuditoria
  entidadId: string
  accion: AccionAuditoria
  /** Quién ejecutó la acción. */
  actor: { id: string; nombre: string; nombreUsuario: string }
  /** Usuario afectado por la acción, si la acción es sobre un usuario. */
  usuarioAfectadoId: string | null
  /** Sucursal del usuario afectado, si el backend la resuelve. */
  sucursalAfectadaId: string | null
  detalle: DetalleAuditoriaApi | null
  /** Instante ISO en que ocurrió la acción. */
  fecha: string
}

/**
 * Sobre de paginado propio de auditoría (`eventos` en vez de `data`, y sin
 * `totalPaginas`). El backend lo calcula en el servidor; el frontend lo deriva
 * de `total`/`limit` cuando necesita el número de páginas.
 */
export interface PaginaAuditoriaApi<T> {
  eventos: T[]
  total: number
  page: number
  limit: number
}
