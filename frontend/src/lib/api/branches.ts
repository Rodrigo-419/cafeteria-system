// Llamadas a sucursales y a la carta por sucursal.
import { peticionApi } from './client'
import { construirQueryString } from './query'
import type { CartaOferta, EstadoOferta, SucursalApi } from '@/types/api'

/**
 * `GET /api/branches/:sucursalId/products`: carta de la sucursal.
 *
 * El backend devuelve solo las ofertas activas a un Empleado; el Gerente y el
 * Admin ven tambi�n las inactivas. Para vender solo sirven las activas. El
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

/** `GET /api/branches/:id`: obtiene una sucursal. */
export function obtenerSucursal(id: string): Promise<SucursalApi> {
  return peticionApi<SucursalApi>(`/branches/${encodeURIComponent(id)}`)
}

export interface EntradaCrearSucursal {
  nombre: string
  direccion: string
  telefono?: string | null
}

export interface EntradaActualizarSucursal {
  nombre?: string
  direccion?: string
  telefono?: string | null
}

/** `POST /api/branches`: crea una sucursal (solo Admin). */
export function crearSucursal(
  entrada: EntradaCrearSucursal,
): Promise<SucursalApi> {
  return peticionApi<SucursalApi>('/branches', {
    method: 'POST',
    body: entrada,
  })
}

/** `PATCH /api/branches/:id`: actualiza una sucursal (solo Admin). */
export function actualizarSucursal(
  id: string,
  entrada: EntradaActualizarSucursal,
): Promise<SucursalApi> {
  return peticionApi<SucursalApi>(`/branches/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: entrada,
  })
}