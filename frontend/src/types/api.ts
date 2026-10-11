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
