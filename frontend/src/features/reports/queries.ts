// Consultas del módulo de reportes (TanStack Query).
//
// La ruta `GET /reports/comparativo` exige `reportes.comparativos.ver` (solo
// Admin), así que la consulta solo se habilita con ese permiso efectivo. El
// listado de sucursales se reutiliza para poblar el filtro opcional.
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { listarSucursales } from '@/lib/api/branches'
import {
  obtenerReporteComparativo,
  type FiltrosComparativo,
} from '@/lib/api/reports'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import type { ReporteComparativoApi, SucursalApi } from '@/types/api'

export const clavesReportes = {
  comparativo: (filtros: FiltrosComparativo) =>
    [
      'reportes',
      'comparativo',
      filtros.desde,
      filtros.hasta,
      filtros.sucursalId ?? 'todas',
    ] as const,
  sucursales: ['reportes', 'sucursales'] as const,
}

/**
 * Reporte comparativo del rango solicitado. Con `filtros` en `null` la consulta
 * queda deshabilitada (aún no se generó un reporte válido).
 */
export function useReporteComparativo(
  filtros: FiltrosComparativo | null,
): UseQueryResult<ReporteComparativoApi> {
  const { permisos } = useAuth()
  const permitido =
    tienePermiso(permisos, 'reportes.comparativos.ver') && filtros !== null

  return useQuery({
    queryKey: filtros
      ? clavesReportes.comparativo(filtros)
      : (['reportes', 'comparativo', 'inactivo'] as const),
    queryFn: () => {
      if (!filtros) throw new Error('Faltan los filtros del reporte')
      return obtenerReporteComparativo(filtros)
    },
    enabled: permitido,
  })
}

/** Sucursales para el filtro opcional del reporte. */
export function useSucursalesParaReporte(): UseQueryResult<SucursalApi[]> {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'reportes.comparativos.ver')

  return useQuery({
    queryKey: clavesReportes.sucursales,
    queryFn: listarSucursales,
    enabled: permitido,
  })
}
