// Llamadas del módulo de personal contra el backend.
//
// Todas las rutas de empleados exigen `empleados.crear_editar` (listar, ver,
// crear, editar y cesar). El alcance lo impone el backend: un Admin gestiona a
// todos; un Gerente solo a los empleados cuyo usuario tiene rol Empleado y
// pertenece a su sucursal (otro responde 404, no 403).
//
// El alta vincula un usuario existente: el empleado hereda su sucursal, así que
// `sucursalId` es opcional y, si se envía, debe coincidir con la del usuario.
// No hay borrado de empleados: el cese (`POST /:id/cese`) los deja `inactivo`.
import { peticionApi } from './client'
import { construirQueryString } from './query'
import type {
  EmpleadoApi,
  EstadoEmpleado,
  PaginadoApi,
  PinEmpleadoApi,
} from '@/types/api'

export interface FiltrosEmpleados {
  page?: number
  limit?: number
  sucursalId?: string
  estado?: EstadoEmpleado
  /** Búsqueda por nombre, nombre de usuario o cargo. */
  q?: string
}

/**
 * Cuerpo de `POST /employees`. `sucursalId` es opcional: si falta, el empleado
 * hereda la del usuario vinculado.
 */
export interface EntradaCrearEmpleado {
  usuarioId: string
  cargo: string
  fechaContratacion: string
  sucursalId?: string
}

/** Cuerpo de `POST /employees/:id/cese`: la fecha es opcional (por defecto hoy). */
export interface EntradaCesarEmpleado {
  fechaCese?: string
}

/** `GET /api/employees`: listado paginado de empleados dentro del alcance. */
export function listarEmpleados(
  filtros: FiltrosEmpleados = {},
): Promise<PaginadoApi<EmpleadoApi>> {
  return peticionApi<PaginadoApi<EmpleadoApi>>(
    `/employees${construirQueryString(filtros)}`,
  )
}

/** `GET /api/employees/:id`: detalle de un empleado dentro del alcance. */
export function obtenerEmpleado(id: string): Promise<EmpleadoApi> {
  return peticionApi<EmpleadoApi>(`/employees/${id}`)
}

/** `POST /api/employees`: registra un empleado a partir de un usuario (201). */
export function crearEmpleado(
  entrada: EntradaCrearEmpleado,
): Promise<EmpleadoApi> {
  return peticionApi<EmpleadoApi>('/employees', {
    method: 'POST',
    body: entrada,
  })
}

/** `PATCH /api/employees/:id`: edita el cargo (único campo editable). */
export function actualizarCargoEmpleado(
  id: string,
  cargo: string,
): Promise<EmpleadoApi> {
  return peticionApi<EmpleadoApi>(`/employees/${id}`, {
    method: 'PATCH',
    body: { cargo },
  })
}

/**
 * `POST /api/employees/:id/cese`: cesa al empleado y bloquea su cuenta. El
 * backend responde 200 con el empleado cesado (409 si ya estaba cesado).
 */
export function cesarEmpleado(
  id: string,
  entrada: EntradaCesarEmpleado = {},
): Promise<EmpleadoApi> {
  return peticionApi<EmpleadoApi>(`/employees/${id}/cese`, {
    method: 'POST',
    body: entrada,
  })
}

/**
 * `POST /api/employees/:id/pin`: genera un PIN de marcación de 6 dígitos. El PIN
 * en claro solo se devuelve en esta respuesta y no se puede recuperar después.
 */
export function regenerarPinEmpleado(id: string): Promise<PinEmpleadoApi> {
  return peticionApi<PinEmpleadoApi>(`/employees/${id}/pin`, { method: 'POST' })
}
