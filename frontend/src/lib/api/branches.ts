// Llamadas a la carta de una sucursal y al listado de sucursales.
import { peticionApi } from './client'
import { construirQueryString } from './query'
import type { CartaOferta, EstadoOferta, SucursalApi } from '@/types/api'

/**
 * `GET /api/branches/:sucursalId/products`: carta de la sucursal.
 *
 * El backend devuelve solo las ofertas activas a un Empleado; el Gerente y el
 * Admin ven también las inactivas. Para vender solo sirven las activas. El
 * filtro `estado` se recorta en el servidor a lo que el rol puede ver.
 */
export function listarCarta(
  sucursalId: string,
  estado?: EstadoOferta,
): Promise<CartaOferta[]> {
  return peticionApi<CartaOferta[]>(
    `/branches/${sucursalId}/products${construirQueryString({ estado })}`,
  )
}

/** `GET /api/branches`: el Admin ve todas; el resto, solo la suya. */
export function listarSucursales(): Promise<SucursalApi[]> {
  return peticionApi<SucursalApi[]>('/branches')
}
