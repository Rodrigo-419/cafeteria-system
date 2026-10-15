// Llamadas del módulo de turnos contra el backend.
//
// Todas las rutas (`GET`, `POST` y `PATCH /shifts`) exigen el permiso
// `turnos.editar`, que es el mismo que da la lectura: no existe `turnos.ver`. El
// alcance lo aplica el backend (Admin todas las sucursales; Gerente solo la
// suya, fuera de alcance responde 404). No hay DELETE de turnos: `PATCH` solo
// cambia horas y días, nunca el tipo ni la sucursal.
import { peticionApi } from './client'
import { construirQueryString } from './query'
import type { PaginadoApi, TipoTurno, TurnoApi } from '@/types/api'

export interface FiltrosTurnos {
  page?: number
  limit?: number
  sucursalId?: string
  tipo?: TipoTurno
}

/** Cuerpo de `POST /shifts`. Solo el Admin envía `sucursalId`. */
export interface EntradaCrearTurno {
  sucursalId?: string
  tipo: TipoTurno
  horaInicio?: string
  horaFin?: string
  diasSemana?: string
}

/** Cuerpo de `PATCH /shifts/:id`: ni el tipo ni la sucursal se editan. */
export interface EntradaActualizarTurno {
  horaInicio?: string
  horaFin?: string
  diasSemana?: string
}

/** `GET /api/shifts`: listado paginado de turnos dentro del alcance. */
export function listarTurnos(
  filtros: FiltrosTurnos = {},
): Promise<PaginadoApi<TurnoApi>> {
  return peticionApi<PaginadoApi<TurnoApi>>(
    `/shifts${construirQueryString(filtros)}`,
  )
}

/** `GET /api/shifts/:id`: detalle de un turno dentro del alcance. */
export function obtenerTurno(id: string): Promise<TurnoApi> {
  return peticionApi<TurnoApi>(`/shifts/${id}`)
}

/** `POST /api/shifts`: crea un turno fijo o variable (201). */
export function crearTurno(entrada: EntradaCrearTurno): Promise<TurnoApi> {
  return peticionApi<TurnoApi>('/shifts', { method: 'POST', body: entrada })
}

/** `PATCH /api/shifts/:id`: edita horas y días de la semana. */
export function actualizarTurno(
  id: string,
  entrada: EntradaActualizarTurno,
): Promise<TurnoApi> {
  return peticionApi<TurnoApi>(`/shifts/${id}`, {
    method: 'PATCH',
    body: entrada,
  })
}
