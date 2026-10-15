// Llamadas del módulo de asignaciones de turno contra el backend.
//
// Todas las rutas exigen `turnos.editar`. No existe `DELETE`: retirar una
// asignación es un `PATCH` que fija su `fechaFin`. El backend valida que el
// empleado y el turno sean de la misma sucursal, que el empleado esté activo y
// que no se solape con otra asignación del mismo empleado.
import { peticionApi } from './client'
import { construirQueryString } from './query'
import type { AsignacionApi, PaginadoApi } from '@/types/api'

export interface FiltrosAsignaciones {
  page?: number
  limit?: number
  empleadoId?: string
  turnoId?: string
  /** `true` para ver solo las asignaciones vigentes hoy (día de negocio). */
  vigente?: boolean
}

/** Cuerpo de `POST /assignments`. */
export interface EntradaCrearAsignacion {
  empleadoId: string
  turnoId: string
  fechaInicio: string
  fechaFin?: string
}

/** Cuerpo de `PATCH /assignments/:id`: solo fija la fecha de fin. */
export interface EntradaRetirarAsignacion {
  fechaFin: string
}

/** `GET /api/assignments`: listado paginado de asignaciones del alcance. */
export function listarAsignaciones(
  filtros: FiltrosAsignaciones = {},
): Promise<PaginadoApi<AsignacionApi>> {
  return peticionApi<PaginadoApi<AsignacionApi>>(
    `/assignments${construirQueryString(filtros)}`,
  )
}

/** `POST /api/assignments`: asigna un turno a un empleado (201). */
export function crearAsignacion(
  entrada: EntradaCrearAsignacion,
): Promise<AsignacionApi> {
  return peticionApi<AsignacionApi>('/assignments', {
    method: 'POST',
    body: entrada,
  })
}

/** `PATCH /api/assignments/:id`: retira la asignación fijando `fechaFin`. */
export function retirarAsignacion(
  id: string,
  entrada: EntradaRetirarAsignacion,
): Promise<AsignacionApi> {
  return peticionApi<AsignacionApi>(`/assignments/${id}`, {
    method: 'PATCH',
    body: entrada,
  })
}
