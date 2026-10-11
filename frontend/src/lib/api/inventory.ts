// Llamadas del módulo de alertas de stock contra el backend.
//
// Solo hay listado (`GET /inventario/alertas`): las alertas se abren y se
// cierran solas cuando cambia el stock, el mínimo o el estado. El permiso que
// exige la ruta es `alertas.ver_resolver`.
import { peticionApi } from './client'
import { construirQueryString } from './query'
import type {
  AlertaStockApi,
  EstadoAlertaStock,
  PaginadoApi,
} from '@/types/api'

export interface FiltrosAlertas {
  page?: number
  limit?: number
  sucursalId?: string
  estado?: EstadoAlertaStock
}

/** `GET /api/inventario/alertas`: listado paginado acotado al alcance. */
export function listarAlertas(
  filtros: FiltrosAlertas = {},
): Promise<PaginadoApi<AlertaStockApi>> {
  return peticionApi<PaginadoApi<AlertaStockApi>>(
    `/inventario/alertas${construirQueryString(filtros)}`,
  )
}
