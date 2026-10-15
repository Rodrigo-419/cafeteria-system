// Consultas y mutaciones del módulo de turnos y asignaciones (TanStack Query).
//
// Todas las rutas exigen `turnos.editar` (el mismo permiso da lectura y
// escritura); el backend sigue siendo la autoridad de alcance y validaciones.
// Tras cada cambio se invalidan `['turnos']` y `['auditoria']`: los turnos y las
// asignaciones quedan registrados en la auditoría y no existe una feature de
// asistencia que dependa de ellos.
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { listarSucursales } from '@/lib/api/branches'
import {
  actualizarTurno,
  crearTurno,
  listarTurnos,
  type EntradaActualizarTurno,
  type EntradaCrearTurno,
  type FiltrosTurnos,
} from '@/lib/api/shifts'
import {
  crearAsignacion,
  listarAsignaciones,
  retirarAsignacion,
  type EntradaCrearAsignacion,
  type FiltrosAsignaciones,
} from '@/lib/api/assignments'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import type { AsignacionApi, TurnoApi } from '@/types/api'

/** Tope por página que acepta el backend en los listados. */
export const LIMITE_LISTA = 100

/**
 * Tope de páginas que recorre el calendario al reunir todas las asignaciones.
 * Con 100 por página cubre hasta 1000 asignaciones; si hay más, la vista avisa
 * de que el cuadro está truncado en vez de mentir con datos incompletos.
 */
export const MAX_PAGINAS_CALENDARIO = 10

export const clavesTurnos = {
  lista: (filtros: FiltrosTurnos) => ['turnos', 'lista', filtros] as const,
  detalle: (id: string) => ['turnos', 'detalle', id] as const,
  asignaciones: (filtros: FiltrosAsignaciones) =>
    ['turnos', 'asignaciones', filtros] as const,
  todasAsignaciones: ['turnos', 'asignaciones', 'todas'] as const,
  sucursales: ['turnos', 'sucursales'] as const,
}

/** Turnos visibles para el usuario. Requiere `turnos.editar`. */
export function useTurnos(filtros: FiltrosTurnos) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'turnos.editar')

  return useQuery({
    queryKey: clavesTurnos.lista(filtros),
    queryFn: () => listarTurnos(filtros),
    enabled: permitido,
    placeholderData: (anterior) => anterior,
  })
}

/** Asignaciones visibles para el usuario. Requiere `turnos.editar`. */
export function useAsignaciones(filtros: FiltrosAsignaciones) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'turnos.editar')

  return useQuery({
    queryKey: clavesTurnos.asignaciones(filtros),
    queryFn: () => listarAsignaciones(filtros),
    enabled: permitido,
    placeholderData: (anterior) => anterior,
  })
}

export interface AsignacionesCompletas {
  items: AsignacionApi[]
  total: number
  /** `true` si se alcanzó el tope de páginas antes de traer todo. */
  truncado: boolean
}

/**
 * Reúne todas las asignaciones del alcance para pintar el calendario semanal.
 * Recorre las páginas hasta `totalPaginas` o hasta `MAX_PAGINAS_CALENDARIO`.
 */
export function useTodasAsignaciones() {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'turnos.editar')

  return useQuery<AsignacionesCompletas>({
    queryKey: clavesTurnos.todasAsignaciones,
    queryFn: async () => {
      const primera = await listarAsignaciones({ page: 1, limit: LIMITE_LISTA })
      const items = [...primera.data]
      const paginas = Math.min(primera.totalPaginas, MAX_PAGINAS_CALENDARIO)

      for (let pagina = 2; pagina <= paginas; pagina += 1) {
        const siguiente = await listarAsignaciones({
          page: pagina,
          limit: LIMITE_LISTA,
        })
        items.push(...siguiente.data)
      }

      return {
        items,
        total: primera.total,
        truncado: primera.totalPaginas > MAX_PAGINAS_CALENDARIO,
      }
    },
    enabled: permitido,
  })
}

/** Sucursales para que el Admin filtre y muestre la columna por sucursal. */
export function useSucursalesTurnos(habilitado: boolean) {
  return useQuery({
    queryKey: clavesTurnos.sucursales,
    queryFn: listarSucursales,
    enabled: habilitado,
  })
}

/**
 * Turnos de una sucursal concreta, para el selector del diálogo de asignación.
 * Se activa cuando hay una sucursal elegida (la del empleado seleccionado).
 */
export function useTurnosDeSucursal(sucursalId: string | null) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'turnos.editar')
  const filtros: FiltrosTurnos = {
    page: 1,
    limit: LIMITE_LISTA,
    ...(sucursalId !== null ? { sucursalId } : {}),
  }

  return useQuery({
    queryKey: clavesTurnos.lista(filtros),
    queryFn: () => listarTurnos(filtros),
    enabled: permitido && sucursalId !== null,
  })
}

/**
 * Invalida los listados de turnos/asignaciones y la auditoría, que deja
 * constancia de los cambios.
 */
function invalidarTurnos(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['turnos'] })
  void queryClient.invalidateQueries({ queryKey: ['auditoria'] })
}

/** Crea un turno fijo o variable e invalida los listados. */
export function useCrearTurno(): UseMutationResult<
  TurnoApi,
  unknown,
  EntradaCrearTurno
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearTurno,
    onSuccess: () => invalidarTurnos(queryClient),
  })
}

/** Edita las horas y los días de un turno e invalida los listados. */
export function useActualizarTurno(): UseMutationResult<
  TurnoApi,
  unknown,
  { id: string; entrada: EntradaActualizarTurno }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, entrada }) => actualizarTurno(id, entrada),
    onSuccess: (_data, variables) => {
      invalidarTurnos(queryClient)
      void queryClient.invalidateQueries({
        queryKey: clavesTurnos.detalle(variables.id),
      })
    },
  })
}

/** Asigna un turno a un empleado e invalida los listados. */
export function useCrearAsignacion(): UseMutationResult<
  AsignacionApi,
  unknown,
  EntradaCrearAsignacion
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearAsignacion,
    onSuccess: () => invalidarTurnos(queryClient),
  })
}

/** Retira (cierra) una asignación fijando su fecha de fin. */
export function useRetirarAsignacion(): UseMutationResult<
  AsignacionApi,
  unknown,
  { id: string; fechaFin: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fechaFin }) => retirarAsignacion(id, { fechaFin }),
    onSuccess: () => invalidarTurnos(queryClient),
  })
}
