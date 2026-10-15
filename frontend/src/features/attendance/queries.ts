// Consultas y mutaciones del módulo de asistencia (TanStack Query).
//
// Cada ruta exige un permiso distinto: las lecturas `asistencia.ver`, la
// marcación `asistencia.marcar` y las correcciones/justificaciones
// `asistencia.corregir`. Cada consulta se habilita SOLO con su permiso real; el
// backend sigue siendo la autoridad de alcance y validaciones.
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import {
  corregirRegistro,
  justificarFalta,
  listarEmpleadosTerminal,
  listarFaltas,
  listarRegistros,
  marcarAsistencia,
  obtenerRegistro,
  type EntradaCorregirRegistro,
  type EntradaJustificarFalta,
  type EntradaMarcarAsistencia,
  type FiltrosFaltasAsistencia,
  type FiltrosRegistrosAsistencia,
} from '@/lib/api/attendance'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import type {
  EmpleadoTerminalApi,
  JustificacionFaltaApi,
  ListadoFaltasApi,
  PaginadoAsistenciaApi,
  RegistroAsistenciaApi,
  RegistroAsistenciaDetalleApi,
  RegistroMarcajeApi,
} from '@/types/api'

export const clavesAsistencia = {
  registros: (filtros: FiltrosRegistrosAsistencia) =>
    ['asistencia', 'registros', filtros] as const,
  detalle: (id: string) => ['asistencia', 'registro', id] as const,
  terminal: ['asistencia', 'terminal'] as const,
  faltas: (filtros: FiltrosFaltasAsistencia) =>
    ['asistencia', 'faltas', filtros] as const,
}

/** Registros efectivos visibles para el usuario. Requiere `asistencia.ver`. */
export function useRegistrosAsistencia(filtros: FiltrosRegistrosAsistencia) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'asistencia.ver')

  return useQuery<PaginadoAsistenciaApi<RegistroAsistenciaApi>>({
    queryKey: clavesAsistencia.registros(filtros),
    queryFn: () => listarRegistros(filtros),
    enabled: permitido,
    placeholderData: (anterior) => anterior,
  })
}

/** Detalle de un registro con sus correcciones. Requiere `asistencia.ver`. */
export function useRegistroAsistencia(id: string | null) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'asistencia.ver')

  return useQuery<RegistroAsistenciaDetalleApi>({
    queryKey: clavesAsistencia.detalle(id ?? ''),
    queryFn: () => {
      if (!id) throw new Error('Falta el registro')
      return obtenerRegistro(id)
    },
    enabled: permitido && id !== null,
  })
}

/**
 * Empleados activos de la sucursal para marcar. Requiere `asistencia.marcar` y
 * una sesión CON sucursal (el backend responde 403 sin ella); sin sucursal no se
 * dispara la consulta, para no pedir datos a una ruta que no corresponde.
 */
export function useEmpleadosTerminal() {
  const { permisos, usuario } = useAuth()
  const permitido =
    tienePermiso(permisos, 'asistencia.marcar') && usuario?.sucursalId != null

  return useQuery<EmpleadoTerminalApi[]>({
    queryKey: clavesAsistencia.terminal,
    queryFn: listarEmpleadosTerminal,
    enabled: permitido,
  })
}

/** Faltas de un rango de días. Requiere `asistencia.ver` y el rango completo. */
export function useFaltas(filtros: FiltrosFaltasAsistencia) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'asistencia.ver')
  const rangoValido = filtros.desde !== '' && filtros.hasta !== ''

  return useQuery<ListadoFaltasApi>({
    queryKey: clavesAsistencia.faltas(filtros),
    queryFn: () => listarFaltas(filtros),
    enabled: permitido && rangoValido,
    placeholderData: (anterior) => anterior,
  })
}

/**
 * Marca entrada o salida. No se cachea nada de la respuesta (el PIN y el
 * marcaje son efímeros); solo se refrescan los listados que pueda afectar.
 */
export function useMarcarAsistencia(): UseMutationResult<
  RegistroMarcajeApi,
  unknown,
  EntradaMarcarAsistencia
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: marcarAsistencia,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['asistencia'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/** Corrige un registro e invalida listados y detalle. */
export function useCorregirRegistro(): UseMutationResult<
  RegistroMarcajeApi,
  unknown,
  { id: string; entrada: EntradaCorregirRegistro }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, entrada }) => corregirRegistro(id, entrada),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['asistencia'] })
      void queryClient.invalidateQueries({
        queryKey: clavesAsistencia.detalle(variables.id),
      })
    },
  })
}

/** Justifica una falta e invalida el listado de faltas. */
export function useJustificarFalta(): UseMutationResult<
  JustificacionFaltaApi,
  unknown,
  EntradaJustificarFalta
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: justificarFalta,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['asistencia'] })
    },
  })
}
