// Consultas del panel de control (TanStack Query).
//
// Cada consulta se habilita SOLO con el permiso real que exige su ruta. Así el
// panel nunca llama a una ruta para la que el usuario no tiene permiso, ni
// siquiera cuando el bloque está oculto. El rol no se usa en ningún caso: el
// contenido se decide por PERMISOS EFECTIVOS.
import { useQuery } from '@tanstack/react-query'
import { listarRegistros } from '@/lib/api/attendance'
import { listarEquipos } from '@/lib/api/equipment'
import { listarAlertas } from '@/lib/api/inventory'
import { obtenerReporteComparativo } from '@/lib/api/reports'
import { listarVentas } from '@/lib/api/sales'
import { useAuth } from '@/lib/auth/useAuth'
import { diaDeNegocioLima } from '@/lib/format/dates'
import { tienePermiso } from '@/lib/permissions/permissions'

/** Tope del resumen: el backend acepta hasta 100 por página. */
export const LIMITE_RESUMEN = 100

export const clavesDashboard = {
  ventasHoy: (fecha: string) => ['dashboard', 'ventas-hoy', fecha] as const,
  alertas: ['dashboard', 'alertas-abiertas'] as const,
  asistencia: ['dashboard', 'asistencia-abierta'] as const,
  equipos: ['dashboard', 'equipos'] as const,
  reporte: (desde: string, hasta: string) =>
    ['dashboard', 'reporte', desde, hasta] as const,
}

/** Ventas del día de negocio en curso. Requiere `ventas.ver`. */
export function useVentasDelDia() {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'ventas.ver')
  const hoy = diaDeNegocioLima(new Date())

  return useQuery({
    queryKey: clavesDashboard.ventasHoy(hoy),
    queryFn: () => listarVentas({ fecha: hoy, limit: LIMITE_RESUMEN }),
    enabled: permitido,
  })
}

/** Alertas de stock abiertas. Requiere `alertas.ver_resolver`. */
export function useAlertasAbiertas() {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'alertas.ver_resolver')

  return useQuery({
    queryKey: clavesDashboard.alertas,
    queryFn: () => listarAlertas({ estado: 'abierta', limit: LIMITE_RESUMEN }),
    enabled: permitido,
  })
}

/** Entradas de asistencia sin salida cerrada. Requiere `asistencia.ver`. */
export function useAsistenciaAbierta() {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'asistencia.ver')

  return useQuery({
    queryKey: clavesDashboard.asistencia,
    queryFn: () => listarRegistros({ abierta: true, limit: LIMITE_RESUMEN }),
    enabled: permitido,
  })
}

/** Equipos visibles para el usuario. Requiere `equipo.ver`. */
export function useEquipos() {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'equipo.ver')

  return useQuery({
    queryKey: clavesDashboard.equipos,
    queryFn: () => listarEquipos({ limit: LIMITE_RESUMEN }),
    enabled: permitido,
  })
}

/**
 * Reporte comparativo de sucursales del día en curso.
 * Requiere `reportes.comparativos.ver` (solo Admin).
 */
export function useReporteComparativo() {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'reportes.comparativos.ver')
  const hoy = diaDeNegocioLima(new Date())

  return useQuery({
    queryKey: clavesDashboard.reporte(hoy, hoy),
    queryFn: () => obtenerReporteComparativo({ desde: hoy, hasta: hoy }),
    enabled: permitido,
  })
}
