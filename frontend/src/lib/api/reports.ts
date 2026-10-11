// Llamadas del módulo de reportes contra el backend.
//
// Una sola ruta de solo lectura: `GET /reports/comparativo`. Exige
// `reportes.comparativos.ver` (solo Admin). El rango `desde`/`hasta` es
// inclusivo y ambos son días de negocio en America/Lima ("AAAA-MM-DD").
import { peticionApi } from './client'
import { construirQueryString } from './query'
import type { ReporteComparativoApi } from '@/types/api'

export interface FiltrosComparativo {
  /** Inicio del rango, día de negocio en America/Lima ("AAAA-MM-DD"). */
  desde: string
  /** Fin del rango, día de negocio en America/Lima ("AAAA-MM-DD"). */
  hasta: string
  sucursalId?: string
}

/** `GET /api/reports/comparativo`: comparativo entre sucursales. */
export function obtenerReporteComparativo(
  filtros: FiltrosComparativo,
): Promise<ReporteComparativoApi> {
  return peticionApi<ReporteComparativoApi>(
    `/reports/comparativo${construirQueryString(filtros)}`,
  )
}
