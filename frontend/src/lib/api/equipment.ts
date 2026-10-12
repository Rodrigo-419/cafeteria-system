// Llamadas del módulo de equipos contra el backend.
//
// El listado y el detalle están acotados al alcance del usuario (Admin: todas
// las sucursales; Gerente/Empleado: la suya, otra responde 404). El permiso que
// exige la ruta de lectura es `equipo.ver`; crear y editar exigen
// `equipo.registrar_editar`. No existe borrado de equipos: un equipo retirado es
// un estado terminal.
import { peticionApi } from './client'
import { construirQueryString } from './query'
import type {
  EquipoApi,
  EstadoEquipo,
  HistorialEquipoApi,
  PaginadoApi,
} from '@/types/api'

export interface FiltrosEquipos {
  page?: number
  limit?: number
  sucursalId?: string
  estado?: EstadoEquipo
  busqueda?: string
}

export interface FiltrosHistorialEquipo {
  page?: number
  limit?: number
}

/** Cuerpo de `POST /equipment`. `sucursalId` es obligatorio en el contrato. */
export interface EntradaCrearEquipo {
  sucursalId: string
  nombre: string
  tipo: string
  observaciones?: string | null
}

/** Cuerpo de `PATCH /equipment/:id`: todos los campos son opcionales. */
export interface EntradaActualizarEquipo {
  nombre?: string
  tipo?: string
  estado?: EstadoEquipo
  observaciones?: string | null
}

/** `GET /api/equipment`: listado paginado de equipos visibles. */
export function listarEquipos(
  filtros: FiltrosEquipos = {},
): Promise<PaginadoApi<EquipoApi>> {
  return peticionApi<PaginadoApi<EquipoApi>>(
    `/equipment${construirQueryString(filtros)}`,
  )
}

/** `GET /api/equipment/:id`: detalle de un equipo dentro del alcance. */
export function obtenerEquipo(id: string): Promise<EquipoApi> {
  return peticionApi<EquipoApi>(`/equipment/${id}`)
}

/** `GET /api/equipment/:id/history`: historial de estado y observaciones. */
export function listarHistorialEquipo(
  id: string,
  filtros: FiltrosHistorialEquipo = {},
): Promise<PaginadoApi<HistorialEquipoApi>> {
  return peticionApi<PaginadoApi<HistorialEquipoApi>>(
    `/equipment/${id}/history${construirQueryString(filtros)}`,
  )
}

/** `POST /api/equipment`: registra un equipo (201). */
export function crearEquipo(entrada: EntradaCrearEquipo): Promise<EquipoApi> {
  return peticionApi<EquipoApi>('/equipment', { method: 'POST', body: entrada })
}

/** `PATCH /api/equipment/:id`: edita nombre/tipo/estado/observaciones. */
export function actualizarEquipo(
  id: string,
  entrada: EntradaActualizarEquipo,
): Promise<EquipoApi> {
  return peticionApi<EquipoApi>(`/equipment/${id}`, {
    method: 'PATCH',
    body: entrada,
  })
}
