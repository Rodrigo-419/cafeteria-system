// Llamadas a la carta de una sucursal y al listado de sucursales.
import { peticionApi } from './client'
import type { CartaOferta, SucursalApi } from '@/types/api'

/**
 * `GET /api/branches/:sucursalId/products`: carta de la sucursal.
 *
 * El backend devuelve solo las ofertas activas a un Empleado; el Gerente y el
 * Admin ven también las inactivas. Para vender solo sirven las activas.
 */
export function listarCarta(sucursalId: string): Promise<CartaOferta[]> {
  return peticionApi<CartaOferta[]>(`/branches/${sucursalId}/products`)
}

/** `GET /api/branches`: el Admin ve todas; el resto, solo la suya. */
export function listarSucursales(): Promise<SucursalApi[]> {
  return peticionApi<SucursalApi[]>('/branches')
}
