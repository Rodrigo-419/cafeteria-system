// Consultas y mutaciones del módulo de usuarios (TanStack Query).
//
// Cada consulta se habilita solo con el permiso real que exige su ruta:
// `usuarios.crear_editar` para listado y detalle; `permisos.asignar` para el
// detalle y la asignación de permisos. Las mutaciones se invocan solo desde
// acciones visibles con esos permisos. El backend sigue siendo la autoridad
// (alcance por rol/sucursal, reglas rol-sucursal, último administrador activo).
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { listarSucursales } from '@/lib/api/branches'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import {
  actualizarUsuario,
  asignarPermisoUsuario,
  cambiarEstadoUsuario,
  crearUsuario,
  eliminarPermisoUsuario,
  listarPermisosUsuario,
  listarUsuarios,
  type EntradaActualizarUsuario,
  type EntradaCrearUsuario,
  type FiltrosUsuarios,
  type TipoPermisoIndividual,
} from '@/lib/api/users'
import type {
  EstadoUsuario,
  PaginadoApi,
  PermisoEfectivoApi,
  UsuarioGestionApi,
} from '@/types/api'

export const clavesUsuarios = {
  lista: (filtros: FiltrosUsuarios) => ['usuarios', 'lista', filtros] as const,
  detalle: (id: string) => ['usuarios', 'detalle', id] as const,
  permisos: (id: string) => ['usuarios', 'permisos', id] as const,
  sucursales: ['usuarios', 'sucursales'] as const,
}

/** Usuarios visibles para el usuario. Requiere `usuarios.crear_editar`. */
export function useUsuarios(filtros: FiltrosUsuarios) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'usuarios.crear_editar')

  return useQuery<PaginadoApi<UsuarioGestionApi>>({
    queryKey: clavesUsuarios.lista(filtros),
    queryFn: () => listarUsuarios(filtros),
    enabled: permitido,
    placeholderData: (anterior) => anterior,
  })
}

/** Sucursales para el Admin (filtro y alta) y para mostrar la sucursal forzada. */
export function useSucursalesUsuarios(habilitado: boolean) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'sucursales.ver')

  return useQuery({
    queryKey: clavesUsuarios.sucursales,
    queryFn: listarSucursales,
    enabled: habilitado && permitido,
  })
}

/** Permisos efectivos de un usuario. Requiere `permisos.asignar`. */
export function usePermisosUsuario(id: string | null) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'permisos.asignar')

  return useQuery<PermisoEfectivoApi[]>({
    queryKey: clavesUsuarios.permisos(id ?? ''),
    queryFn: () => {
      if (!id) throw new Error('Falta el usuario')
      return listarPermisosUsuario(id)
    },
    enabled: permitido && id !== null,
  })
}

function invalidarUsuarios(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['usuarios'] })
}

/** Crea un usuario e invalida los listados. */
export function useCrearUsuario(): UseMutationResult<
  UsuarioGestionApi,
  unknown,
  EntradaCrearUsuario
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearUsuario,
    onSuccess: () => invalidarUsuarios(queryClient),
  })
}

/** Edita un usuario (nombre, nombre de usuario, rol/sucursal si es Admin). */
export function useActualizarUsuario(): UseMutationResult<
  UsuarioGestionApi,
  unknown,
  { id: string; entrada: EntradaActualizarUsuario }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, entrada }) => actualizarUsuario(id, entrada),
    onSuccess: (_data, variables) => {
      invalidarUsuarios(queryClient)
      void queryClient.invalidateQueries({
        queryKey: clavesUsuarios.detalle(variables.id),
      })
    },
  })
}

/** Bloquea o reactiva un usuario. */
export function useCambiarEstadoUsuario(): UseMutationResult<
  UsuarioGestionApi,
  unknown,
  { id: string; estado: EstadoUsuario }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, estado }) => cambiarEstadoUsuario(id, estado),
    onSuccess: () => invalidarUsuarios(queryClient),
  })
}

/** Registra una asignación individual (conceder o revocar) de un permiso. */
export function useAsignarPermisoUsuario(): UseMutationResult<
  void,
  unknown,
  { id: string; permisoId: string; tipo: TipoPermisoIndividual }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, permisoId, tipo }) =>
      asignarPermisoUsuario(id, permisoId, tipo),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: clavesUsuarios.permisos(variables.id),
      })
    },
  })
}

/** Quita una concesión individual (volver al valor que da el rol). */
export function useEliminarPermisoUsuario(): UseMutationResult<
  void,
  unknown,
  { id: string; permisoId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, permisoId }) => eliminarPermisoUsuario(id, permisoId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: clavesUsuarios.permisos(variables.id),
      })
    },
  })
}