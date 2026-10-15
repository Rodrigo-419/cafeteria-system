// Consultas y mutaciones del módulo de personal (TanStack Query).
//
// Todas las rutas exigen `empleados.crear_editar`, así que cada consulta se
// habilita con ese permiso (el backend sigue siendo la autoridad de alcance y
// validaciones). Para vincular un usuario en el alta se reutilizan las rutas
// existentes de usuarios (`GET /users`) y de empleados (`GET /employees`), que
// exige además `usuarios.crear_editar`.
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { listarSucursales } from '@/lib/api/branches'
import {
  actualizarCargoEmpleado,
  cesarEmpleado,
  crearEmpleado,
  listarEmpleados,
  obtenerEmpleado,
  regenerarPinEmpleado,
  type EntradaCesarEmpleado,
  type EntradaCrearEmpleado,
  type FiltrosEmpleados,
} from '@/lib/api/employees'
import { listarUsuarios } from '@/lib/api/users'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import type {
  EmpleadoApi,
  PaginadoApi,
  PinEmpleadoApi,
  UsuarioGestionApi,
} from '@/types/api'

/**
 * Tope de usuarios y empleados que se traen para armar el selector de vínculo.
 * El backend acepta hasta 100 por página; con más usuarios el filtro de búsqueda
 * (`q`) acota el resultado.
 */
export const LIMITE_VINCULO = 100

export const clavesEmpleados = {
  lista: (filtros: FiltrosEmpleados) => ['empleados', 'lista', filtros] as const,
  detalle: (id: string) => ['empleados', 'detalle', id] as const,
  sucursales: ['empleados', 'sucursales'] as const,
  usuariosVinculables: (q: string) =>
    ['empleados', 'usuarios-vinculables', q] as const,
  vinculados: ['empleados', 'vinculados'] as const,
}

/** Empleados visibles para el usuario. Requiere `empleados.crear_editar`. */
export function useEmpleados(filtros: FiltrosEmpleados) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'empleados.crear_editar')

  return useQuery({
    queryKey: clavesEmpleados.lista(filtros),
    queryFn: () => listarEmpleados(filtros),
    enabled: permitido,
    placeholderData: (anterior) => anterior,
  })
}

/** Detalle de un empleado. Requiere `empleados.crear_editar`. */
export function useEmpleado(id: string | null) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'empleados.crear_editar')

  return useQuery<EmpleadoApi>({
    queryKey: clavesEmpleados.detalle(id ?? ''),
    queryFn: () => {
      if (!id) throw new Error('Falta el empleado')
      return obtenerEmpleado(id)
    },
    enabled: permitido && id !== null,
  })
}

/** Sucursales para que el Admin filtre y muestre la columna por sucursal. */
export function useSucursalesEmpleados(habilitado: boolean) {
  return useQuery({
    queryKey: clavesEmpleados.sucursales,
    queryFn: listarSucursales,
    enabled: habilitado,
  })
}

/**
 * Usuarios disponibles para vincular en el alta. Se apoya en `GET /users`
 * (alcance y búsqueda reales del backend) y exige `usuarios.crear_editar`; el
 * filtrado a roles vinculables y a los ya empleados se hace en el diálogo.
 */
export function useUsuariosVinculables(q: string, habilitado: boolean) {
  return useQuery<PaginadoApi<UsuarioGestionApi>>({
    queryKey: clavesEmpleados.usuariosVinculables(q),
    queryFn: () =>
      listarUsuarios({
        page: 1,
        limit: LIMITE_VINCULO,
        ...(q.trim() !== '' ? { q: q.trim() } : {}),
      }),
    enabled: habilitado,
  })
}

/**
 * Conjunto de `usuarioId` que ya están vinculados a un empleado, para atenuarlos
 * en el selector. Es una ayuda de interfaz: el backend responde 409 si el
 * usuario ya es empleado, y eso sigue siendo la autoridad.
 */
export function useEmpleadosVinculados(habilitado: boolean) {
  const { permisos } = useAuth()
  const permitido =
    habilitado && tienePermiso(permisos, 'empleados.crear_editar')

  return useQuery<Set<string>>({
    queryKey: clavesEmpleados.vinculados,
    queryFn: async () => {
      const pagina = await listarEmpleados({ page: 1, limit: LIMITE_VINCULO })
      return new Set(pagina.data.map((empleado) => empleado.usuarioId))
    },
    enabled: permitido,
  })
}

/**
 * Invalida los listados de personal y, tras un cese, los de usuarios: el cese
 * bloquea la cuenta vinculada en la misma operación. También la auditoría, que
 * deja constancia de los cambios.
 */
function invalidarEmpleados(
  queryClient: ReturnType<typeof useQueryClient>,
  { afectaUsuarios = false }: { afectaUsuarios?: boolean } = {},
) {
  void queryClient.invalidateQueries({ queryKey: ['empleados'] })
  void queryClient.invalidateQueries({ queryKey: ['auditoria'] })
  if (afectaUsuarios) {
    void queryClient.invalidateQueries({ queryKey: ['usuarios'] })
  }
}

/** Registra un empleado a partir de un usuario e invalida los listados. */
export function useCrearEmpleado(): UseMutationResult<
  EmpleadoApi,
  unknown,
  EntradaCrearEmpleado
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearEmpleado,
    onSuccess: () => invalidarEmpleados(queryClient),
  })
}

/** Edita el cargo de un empleado e invalida listado y detalle. */
export function useActualizarCargoEmpleado(): UseMutationResult<
  EmpleadoApi,
  unknown,
  { id: string; cargo: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, cargo }) => actualizarCargoEmpleado(id, cargo),
    onSuccess: (_data, variables) => {
      invalidarEmpleados(queryClient)
      void queryClient.invalidateQueries({
        queryKey: clavesEmpleados.detalle(variables.id),
      })
    },
  })
}

/** Cesa a un empleado (y bloquea su cuenta) e invalida listados. */
export function useCesarEmpleado(): UseMutationResult<
  EmpleadoApi,
  unknown,
  { id: string; entrada: EntradaCesarEmpleado }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, entrada }) => cesarEmpleado(id, entrada),
    onSuccess: (_data, variables) => {
      invalidarEmpleados(queryClient, { afectaUsuarios: true })
      void queryClient.invalidateQueries({
        queryKey: clavesEmpleados.detalle(variables.id),
      })
    },
  })
}

/**
 * Genera un PIN de marcación. La respuesta con el PIN en claro NO se cachea: el
 * valor se entrega al diálogo y se descarta al cerrarlo.
 */
export function useRegenerarPinEmpleado(): UseMutationResult<
  PinEmpleadoApi,
  unknown,
  string
> {
  return useMutation({
    mutationFn: regenerarPinEmpleado,
  })
}
