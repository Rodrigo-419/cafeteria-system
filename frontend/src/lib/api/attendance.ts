// Llamadas del módulo de asistencia contra el backend.
//
// La lectura usa el registro EFECTIVO: el filtro `abierta` permite pedir solo
// las entradas que aún no tienen salida emparejada. El permiso que exige la
// ruta es `asistencia.ver`.
import { peticionApi } from './client'
import { construirQueryString } from './query'
import type {
  PaginadoAsistenciaApi,
  RegistroAsistenciaApi,
} from '@/types/api'

export interface FiltrosRegistrosAsistencia {
  page?: number
  limit?: number
  empleadoId?: string
  sucursalId?: string
  /** Día de negocio en America/Lima ("AAAA-MM-DD"). */
  desde?: string
  /** Día de negocio en America/Lima ("AAAA-MM-DD"). */
  hasta?: string
  abierta?: boolean
}

/**
 * `GET /api/attendance/records`: listado paginado de registros efectivos.
 *
 * Este listado usa un sobre propio (`items`) distinto al de ventas (`data`).
 */
export function listarRegistros(
  filtros: FiltrosRegistrosAsistencia = {},
): Promise<PaginadoAsistenciaApi<RegistroAsistenciaApi>> {
  return peticionApi<PaginadoAsistenciaApi<RegistroAsistenciaApi>>(
    `/attendance/records${construirQueryString(filtros)}`,
  )
}
