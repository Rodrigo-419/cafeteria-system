// Llamadas del módulo de equipos contra el backend.
//
// El listado está acotado al alcance del usuario (Admin: todas las sucursales;
// Gerente/Empleado: la suya). El permiso que exige la ruta es `equipo.ver`.
import { peticionApi } from './client'
import { construirQueryString } from './query'
import type { EquipoApi, EstadoEquipo, PaginadoApi } from '@/types/api'

export interface FiltrosEquipos {
  page?: number
  limit?: number
  sucursalId?: string
  estado?: EstadoEquipo
  busqueda?: string
}

/** `GET /api/equipment`: listado paginado de equipos visibles. */
export function listarEquipos(
  filtros: FiltrosEquipos = {},
): Promise<PaginadoApi<EquipoApi>> {
  return peticionApi<PaginadoApi<EquipoApi>>(
    `/equipment${construirQueryString(filtros)}`,
  )
}
