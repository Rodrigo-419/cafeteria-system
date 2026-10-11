// Llamadas del módulo de inventario: catálogo de insumos, stock por sucursal,
// entradas y alertas.
//
// Rutas y permisos según `docs/referencia-api.md`:
// - Catálogo global de insumos: lo edita el Admin (`insumos.catalogo.editar`),
//   lo ven el Admin y el Gerente (`insumos.ver`).
// - Stock por sucursal: `inventario.minimo.editar` para configurar el mínimo y
//   dar de alta; `inventario.registrar` para las entradas.
// - Alertas: solo listado (`alertas.ver_resolver`); las abre y cierra el backend.
import { peticionApi } from './client'
import { construirQueryString } from './query'
import type {
  AlertaStockApi,
  EstadoAlertaStock,
  EstadoStockInsumo,
  InsumoApi,
  PaginadoApi,
  PresentacionInsumo,
  ResultadoEntradaApi,
  StockInsumoApi,
} from '@/types/api'

// ------------------------------------------------------------------ insumos

export interface FiltrosInsumos {
  page?: number
  limit?: number
  q?: string
  presentacion?: PresentacionInsumo
}

export interface EntradaInsumo {
  nombre: string
  presentacion: PresentacionInsumo
}

/** `GET /api/insumos`: catálogo global paginado con búsqueda y filtro. */
export function listarInsumos(
  filtros: FiltrosInsumos = {},
): Promise<PaginadoApi<InsumoApi>> {
  return peticionApi<PaginadoApi<InsumoApi>>(
    `/insumos${construirQueryString(filtros)}`,
  )
}

/** `POST /api/insumos`: crea un insumo (409 si el nombre ya existe). */
export function crearInsumo(entrada: EntradaInsumo): Promise<InsumoApi> {
  return peticionApi<InsumoApi>('/insumos', { method: 'POST', body: entrada })
}

/** `PATCH /api/insumos/:id`: edición parcial de un insumo. */
export function actualizarInsumo(
  id: string,
  entrada: Partial<EntradaInsumo>,
): Promise<InsumoApi> {
  return peticionApi<InsumoApi>(`/insumos/${id}`, {
    method: 'PATCH',
    body: entrada,
  })
}

/** `DELETE /api/insumos/:id`: borra un insumo sin stock (409 si lo tiene). */
export function eliminarInsumo(id: string): Promise<void> {
  return peticionApi<void>(`/insumos/${id}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------- stock

export interface FiltrosStock {
  page?: number
  limit?: number
  estado?: EstadoStockInsumo
  soloBajoMinimo?: boolean
  q?: string
}

/** `GET /api/inventario/sucursales/:sucursalId/stock`: stock paginado. */
export function listarStock(
  sucursalId: string,
  filtros: FiltrosStock = {},
): Promise<PaginadoApi<StockInsumoApi>> {
  return peticionApi<PaginadoApi<StockInsumoApi>>(
    `/inventario/sucursales/${sucursalId}/stock${construirQueryString(filtros)}`,
  )
}

export interface EntradaConfigurarStock {
  stockMinimo?: number
  estado?: EstadoStockInsumo
}

/**
 * `PUT /api/inventario/sucursales/:sucursalId/insumos/:insumoId`: da de alta el
 * insumo en la sucursal (stock 0) o ajusta su mínimo y estado. Al menos uno de
 * los dos campos debe ir; si no, el backend responde 400.
 */
export function configurarStock(
  sucursalId: string,
  insumoId: string,
  entrada: EntradaConfigurarStock,
): Promise<StockInsumoApi> {
  return peticionApi<StockInsumoApi>(
    `/inventario/sucursales/${sucursalId}/insumos/${insumoId}`,
    { method: 'PUT', body: entrada },
  )
}

export interface EntradaRegistrarEntrada {
  cantidad: number
  motivo?: string
}

/**
 * `POST /api/inventario/sucursales/:sucursalId/insumos/:insumoId/entradas`:
 * suma stock y devuelve la fila actualizada y el movimiento. El insumo debe
 * estar dado de alta (404) y no estar descontinuado (409).
 */
export function registrarEntrada(
  sucursalId: string,
  insumoId: string,
  entrada: EntradaRegistrarEntrada,
): Promise<ResultadoEntradaApi> {
  return peticionApi<ResultadoEntradaApi>(
    `/inventario/sucursales/${sucursalId}/insumos/${insumoId}/entradas`,
    { method: 'POST', body: entrada },
  )
}

// ---------------------------------------------------------------- alertas

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
