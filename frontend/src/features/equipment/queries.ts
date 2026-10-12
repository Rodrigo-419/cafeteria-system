// Consultas y mutaciones del módulo de equipos (TanStack Query).
//
// Cada consulta se habilita solo con el permiso real que exige su ruta:
// `equipo.ver` para listado, detalle e historial. Las mutaciones se invocan solo
// desde acciones visibles con `equipo.registrar_editar`. El backend sigue siendo
// la autoridad (alcance por sucursal, estados terminales, validaciones).
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { listarSucursales } from '@/lib/api/branches'
import {
  actualizarEquipo,
  crearEquipo,
  listarEquipos,
  listarHistorialEquipo,
  obtenerEquipo,
  type EntradaActualizarEquipo,
  type EntradaCrearEquipo,
  type FiltrosEquipos,
} from '@/lib/api/equipment'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import type { EquipoApi, HistorialEquipoApi, PaginadoApi } from '@/types/api'

/** Tope del historial: el backend acepta hasta 100 por página. */
export const LIMITE_HISTORIAL_EQUIPO = 100

export const clavesEquipos = {
  lista: (filtros: FiltrosEquipos) => ['equipos', 'lista', filtros] as const,
  detalle: (id: string) => ['equipos', 'detalle', id] as const,
  historial: (id: string) => ['equipos', 'historial', id] as const,
  sucursales: ['equipos', 'sucursales'] as const,
}

/** Equipos visibles para el usuario. Requiere `equipo.ver`. */
export function useEquipos(filtros: FiltrosEquipos) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'equipo.ver')

  return useQuery({
    queryKey: clavesEquipos.lista(filtros),
    queryFn: () => listarEquipos(filtros),
    enabled: permitido,
    placeholderData: (anterior) => anterior,
  })
}

/** Detalle de un equipo. Requiere `equipo.ver`. */
export function useEquipo(id: string | null) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'equipo.ver')

  return useQuery<EquipoApi>({
    queryKey: clavesEquipos.detalle(id ?? ''),
    queryFn: () => {
      if (!id) throw new Error('Falta el equipo')
      return obtenerEquipo(id)
    },
    enabled: permitido && id !== null,
  })
}

/** Historial de un equipo (solo lectura). Requiere `equipo.ver`. */
export function useHistorialEquipo(id: string | null) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'equipo.ver')

  return useQuery<PaginadoApi<HistorialEquipoApi>>({
    queryKey: clavesEquipos.historial(id ?? ''),
    queryFn: () => {
      if (!id) throw new Error('Falta el equipo')
      return listarHistorialEquipo(id, { page: 1, limit: LIMITE_HISTORIAL_EQUIPO })
    },
    enabled: permitido && id !== null,
  })
}

/** Sucursales para que el Admin elija dónde crear y filtrar. */
export function useSucursalesEquipos(habilitado: boolean) {
  return useQuery({
    queryKey: clavesEquipos.sucursales,
    queryFn: listarSucursales,
    enabled: habilitado,
  })
}

function invalidarEquipos(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['equipos'] })
  // El panel de control muestra un bloque de equipos con su propia clave.
  void queryClient.invalidateQueries({ queryKey: ['dashboard', 'equipos'] })
}

/** Registra un equipo e invalida los listados. */
export function useCrearEquipo(): UseMutationResult<
  EquipoApi,
  unknown,
  EntradaCrearEquipo
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearEquipo,
    onSuccess: () => invalidarEquipos(queryClient),
  })
}

/** Edita un equipo (incluido el cambio de estado) e invalida listado e historial. */
export function useActualizarEquipo(): UseMutationResult<
  EquipoApi,
  unknown,
  { id: string; entrada: EntradaActualizarEquipo }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, entrada }) => actualizarEquipo(id, entrada),
    onSuccess: (_data, variables) => {
      invalidarEquipos(queryClient)
      void queryClient.invalidateQueries({
        queryKey: clavesEquipos.detalle(variables.id),
      })
      void queryClient.invalidateQueries({
        queryKey: clavesEquipos.historial(variables.id),
      })
    },
  })
}
