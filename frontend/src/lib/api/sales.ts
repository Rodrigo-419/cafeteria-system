// Llamadas del módulo de ventas contra el backend.
//
// Los precios NO se envían al registrar: el servidor los lee de la carta y los
// congela. Aquí solo van la oferta y la cantidad de cada línea, más el método
// de pago.
import { peticionApi } from './client'
import type {
  EstadoVenta,
  MetodoPagoVenta,
  PaginadoApi,
  VentaApi,
  VentaCompletaApi,
} from '@/types/api'

export interface FiltrosVentas {
  page?: number
  limit?: number
  sucursalId?: string
  estado?: EstadoVenta
  metodoPago?: MetodoPagoVenta
  /** Día de negocio en America/Lima ("AAAA-MM-DD"). */
  fecha?: string
}

export interface LineaVentaEntrada {
  productoSucursalVarianteId: string
  cantidad: number
}

export interface RegistrarVentaEntrada {
  metodoPago: MetodoPagoVenta
  items: LineaVentaEntrada[]
}

function aQueryString(filtros: FiltrosVentas): string {
  const params = new URLSearchParams()
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== '' && valor !== null) {
      params.set(clave, String(valor))
    }
  }
  const cadena = params.toString()
  return cadena.length > 0 ? `?${cadena}` : ''
}

/** `POST /api/sales`: registra una venta en la sucursal del usuario. */
export function registrarVenta(
  entrada: RegistrarVentaEntrada,
): Promise<VentaCompletaApi> {
  return peticionApi<VentaCompletaApi>('/sales', {
    method: 'POST',
    body: entrada,
  })
}

/** `GET /api/sales`: listado paginado con filtros. */
export function listarVentas(
  filtros: FiltrosVentas = {},
): Promise<PaginadoApi<VentaApi>> {
  return peticionApi<PaginadoApi<VentaApi>>(`/sales${aQueryString(filtros)}`)
}

/** `GET /api/sales/:id`: venta con sus líneas. */
export function obtenerVenta(id: string): Promise<VentaCompletaApi> {
  return peticionApi<VentaCompletaApi>(`/sales/${id}`)
}

/** `POST /api/sales/:id/anular`: anula una venta del mismo día, con motivo. */
export function anularVenta(
  id: string,
  motivo: string,
): Promise<VentaCompletaApi> {
  return peticionApi<VentaCompletaApi>(`/sales/${id}/anular`, {
    method: 'POST',
    body: { motivo },
  })
}
