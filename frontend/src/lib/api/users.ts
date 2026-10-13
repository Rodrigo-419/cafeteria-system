// Llamadas del módulo de usuarios contra el backend.
//
// Gestionar usuarios exige `usuarios.crear_editar` (listado, detalle, crear,
// editar, estado y contraseña) y `permisos.asignar` para el detalle y la
// asignación de permisos individuales. El backend es la autoridad: el alcance
// (Admin gestiona a cualquiera; el Gerente solo a Empleados de su sucursal)
// responde 404 fuera de él, y las reglas de rol/sucursal/permisos responden
// 400/403 con su propio mensaje.
import { peticionApi } from './client'
import { construirQueryString } from './query'
import type {
  EstadoUsuario,
  PaginadoApi,
  PermisoEfectivoApi,
  UsuarioGestionApi,
} from '@/types/api'

/** Roles gestionables con las mismas etiquetas que el backend. */
export type NombreRolUsuario = 'Admin' | 'Gerente' | 'Empleado'

/** Tipo de una asignación individual de permiso (`PUT /users/:id/permisos`). */
export type TipoPermisoIndividual = 'concedido' | 'revocado'

export interface FiltrosUsuarios {
  page?: number
  limit?: number
  sucursalId?: string
  rol?: string
  estado?: EstadoUsuario
  /** Búsqueda por nombre o nombre de usuario. */
  q?: string
}

/** Cuerpo de `POST /users`. `sucursalId` es `null` para el rol Admin. */
export interface EntradaCrearUsuario {
  nombre: string
  nombreUsuario: string
  password: string
  rol: NombreRolUsuario
  sucursalId?: string | null
}

/** Cuerpo de `PATCH /users/:id`: todos los campos son opcionales. */
export interface EntradaActualizarUsuario {
  nombre?: string
  nombreUsuario?: string
  /** Solo el Admin puede enviarlos; un Gerente recibe 403. */
  rol?: NombreRolUsuario
  sucursalId?: string | null
}

/** `GET /api/users`: listado paginado de usuarios dentro del alcance. */
export function listarUsuarios(
  filtros: FiltrosUsuarios = {},
): Promise<PaginadoApi<UsuarioGestionApi>> {
  return peticionApi<PaginadoApi<UsuarioGestionApi>>(
    `/users${construirQueryString(filtros)}`,
  )
}

/** `GET /api/users/:id`: detalle de un usuario dentro del alcance. */
export function obtenerUsuario(id: string): Promise<UsuarioGestionApi> {
  return peticionApi<UsuarioGestionApi>(`/users/${id}`)
}

/** `POST /api/users`: crea un usuario (201). */
export function crearUsuario(entrada: EntradaCrearUsuario): Promise<UsuarioGestionApi> {
  return peticionApi<UsuarioGestionApi>('/users', {
    method: 'POST',
    body: entrada,
  })
}

/** `PATCH /api/users/:id`: edita nombre, nombre de usuario y rol/sucursal. */
export function actualizarUsuario(
  id: string,
  entrada: EntradaActualizarUsuario,
): Promise<UsuarioGestionApi> {
  return peticionApi<UsuarioGestionApi>(`/users/${id}`, {
    method: 'PATCH',
    body: entrada,
  })
}

/** `PATCH /api/users/:id/estado`: bloquea o reactiva un usuario. */
export function cambiarEstadoUsuario(
  id: string,
  estado: EstadoUsuario,
): Promise<UsuarioGestionApi> {
  return peticionApi<UsuarioGestionApi>(`/users/${id}/estado`, {
    method: 'PATCH',
    body: { estado },
  })
}

/** `GET /api/users/:id/permisos`: permisos efectivos con su origen. */
export function listarPermisosUsuario(id: string): Promise<PermisoEfectivoApi[]> {
  return peticionApi<PermisoEfectivoApi[]>(`/users/${id}/permisos`)
}

/** `PUT /api/users/:id/permisos/:permisoId`: concede o revoca (204). */
export function asignarPermisoUsuario(
  id: string,
  permisoId: string,
  tipo: TipoPermisoIndividual,
): Promise<void> {
  return peticionApi<void>(`/users/${id}/permisos/${permisoId}`, {
    method: 'PUT',
    body: { tipo },
  })
}

/** `DELETE /api/users/:id/permisos/:permisoId`: quita la concesión (204). */
export function eliminarPermisoUsuario(
  id: string,
  permisoId: string,
): Promise<void> {
  return peticionApi<void>(`/users/${id}/permisos/${permisoId}`, {
    method: 'DELETE',
  })
}