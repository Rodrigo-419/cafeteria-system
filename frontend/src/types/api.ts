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
