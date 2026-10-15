// Llamadas del módulo de asistencia contra el backend.
//
// Las lecturas usan el registro EFECTIVO: el filtro `abierta` permite pedir
// solo las entradas que aún no tienen salida emparejada. La marcación y las
// correcciones exigen permisos distintos (`asistencia.marcar` y
// `asistencia.corregir`), por lo que cada función se expone por separado.
import { peticionApi } from './client'
import { construirQueryString } from './query'
import type {
  EmpleadoTerminalApi,
  JustificacionFaltaApi,
  ListadoFaltasApi,
  PaginadoAsistenciaApi,
  RegistroAsistenciaApi,
  RegistroAsistenciaDetalleApi,
  RegistroMarcajeApi,
  TipoMarcaje,
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

export interface FiltrosFaltasAsistencia {
  /** Día de negocio en America/Lima ("AAAA-MM-DD"). Obligatorio. */
  desde: string
  /** Día de negocio en America/Lima ("AAAA-MM-DD"). Obligatorio. */
  hasta: string
  empleadoId?: string
  sucursalId?: string
}

export interface EntradaMarcarAsistencia {
  empleadoId: string
  tipo: TipoMarcaje
  pin: string
}

export interface EntradaCorregirRegistro {
  motivo: string
  /** Instante ISO 8601. */
  fechaHora: string
  tipo?: TipoMarcaje
}

export interface EntradaJustificarFalta {
  empleadoId: string
  /** Día de negocio en America/Lima ("AAAA-MM-DD"). */
  fecha: string
  motivo: string
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

/** `GET /api/attendance/records/:id`: registro efectivo con sus correcciones. */
export function obtenerRegistro(
  id: string,
): Promise<RegistroAsistenciaDetalleApi> {
  return peticionApi<RegistroAsistenciaDetalleApi>(
    `/attendance/records/${encodeURIComponent(id)}`,
  )
}

/** `GET /api/attendance/terminal/employees`: empleados activos de la sucursal. */
export function listarEmpleadosTerminal(): Promise<EmpleadoTerminalApi[]> {
  return peticionApi<EmpleadoTerminalApi[]>('/attendance/terminal/employees')
}

/**
 * `POST /api/attendance/mark`: registra una marcación. La hora la fija el
 * servidor, así que la respuesta trae el instante real del marcaje.
 */
export function marcarAsistencia(
  entrada: EntradaMarcarAsistencia,
): Promise<RegistroMarcajeApi> {
  return peticionApi<RegistroMarcajeApi>('/attendance/mark', {
    method: 'POST',
    body: entrada,
  })
}

/** `POST /api/attendance/records/:id/correct`: inserta una corrección. */
export function corregirRegistro(
  id: string,
  entrada: EntradaCorregirRegistro,
): Promise<RegistroMarcajeApi> {
  return peticionApi<RegistroMarcajeApi>(
    `/attendance/records/${encodeURIComponent(id)}/correct`,
    { method: 'POST', body: entrada },
  )
}

/** `GET /api/attendance/absences`: faltas de un rango (exige `desde`-`hasta`). */
export function listarFaltas(
  filtros: FiltrosFaltasAsistencia,
): Promise<ListadoFaltasApi> {
  return peticionApi<ListadoFaltasApi>(
    `/attendance/absences${construirQueryString(filtros)}`,
  )
}

/** `POST /api/attendance/absences/justify`: justifica la falta de un día. */
export function justificarFalta(
  entrada: EntradaJustificarFalta,
): Promise<JustificacionFaltaApi> {
  return peticionApi<JustificacionFaltaApi>('/attendance/absences/justify', {
    method: 'POST',
    body: entrada,
  })
}
