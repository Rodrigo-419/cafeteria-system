// Llamadas del módulo de inventario: catálogo de insumos, stock por sucursal,
// entradas, movimientos, recuentos y alertas.
//
// Rutas y permisos según `docs/referencia-api.md`:
// - Catálogo global de insumos: lo edita el Admin (`insumos.catalogo.editar`),
//   lo ven el Admin y el Gerente (`insumos.ver`).
// - Stock por sucursal: `inventario.minimo.editar` para configurar el mínimo y
//   dar de alta; `inventario.registrar` para las entradas y los movimientos.
// - Recuentos: `inventario.recuento` (Admin y Gerente); el listado se acota al
//   alcance y el detalle de otra sucursal responde 404.
// - Alertas: solo listado (`alertas.ver_resolver`); las abre y cierra el backend.
import { peticionApi } from './client'
import { construirQueryString } from './query'
import type {
  AlertaStockApi,
  EstadoAlertaStock,
  EstadoStockInsumo,
  InsumoApi,
  MovimientoInventarioApi,
  PaginadoApi,
  PresentacionInsumo,
  RecuentoApi,
  RecuentoDetalleApi,
  ResultadoEntradaApi,
  StockInsumoApi,
  TipoMovimientoInventario,
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

// ------------------------------------------------- movimientos y recuentos

export interface FiltrosMovimientos {
  page?: number
  limit?: number
  tipo?: TipoMovimientoInventario
  insumoId?: string
  /** Día inicial (inclusive) en `America/Lima`, `YYYY-MM-DD`. */
  desde?: string
  /** Día final (inclusive) en `America/Lima`, `YYYY-MM-DD`. */
  hasta?: string
}

export interface FiltrosRecuentos {
  page?: number
  limit?: number
  sucursalId?: string
}

/** Una línea del cuerpo de un recuento: se identifica por `insumoId` del catálogo. */
export interface ItemRecuentoCrear {
  insumoId: string
  /** Físico contado: no negativo, hasta 2 decimales, admite 0. */
  stockFisico: number
}

export interface EntradaCrearRecuento {
  items: ItemRecuentoCrear[]
}

/**
 * `GET /api/inventario/sucursales/:sucursalId/movimientos`: historial de
 * variaciones de stock de la sucursal (`inventario.registrar`), con filtros
 * `insumoId`, `tipo` y rango `desde`/`hasta`.
 */
export function listarMovimientos(
  sucursalId: string,
  filtros: FiltrosMovimientos = {},
): Promise<PaginadoApi<MovimientoInventarioApi>> {
  return peticionApi<PaginadoApi<MovimientoInventarioApi>>(
    `/inventario/sucursales/${sucursalId}/movimientos${construirQueryString(filtros)}`,
  )
}

/** `GET /api/inventario/recuentos`: listado acotado al alcance (`inventario.recuento`). */
export function listarRecuentos(
  filtros: FiltrosRecuentos = {},
): Promise<PaginadoApi<RecuentoApi>> {
  return peticionApi<PaginadoApi<RecuentoApi>>(
    `/inventario/recuentos${construirQueryString(filtros)}`,
  )
}

/** `GET /api/inventario/recuentos/:id`: detalle con líneas, usuario y sucursal. */
export function obtenerRecuento(id: string): Promise<RecuentoDetalleApi> {
  return peticionApi<RecuentoDetalleApi>(`/inventario/recuentos/${id}`)
}

/**
 * `POST /api/inventario/sucursales/:sucursalId/recuentos`: fija el stock al
 * valor contado. Devuelve la cabecera del recuento creado (201).
 */
export function crearRecuento(
  sucursalId: string,
  entrada: EntradaCrearRecuento,
): Promise<RecuentoApi> {
  return peticionApi<RecuentoApi>(
    `/inventario/sucursales/${sucursalId}/recuentos`,
    { method: 'POST', body: entrada },
  )
}

// ------------------------------------------------------------------ alertas

export interface FiltrosAlertas {
  page?: number
  limit?: number
  estado?: EstadoAlertaStock
  sucursalId?: string
}

/** `GET /api/inventario/alertas`: listado paginado acotado al alcance. */
export function listarAlertas(
  filtros: FiltrosAlertas = {},
): Promise<PaginadoApi<AlertaStockApi>> {
  return peticionApi<PaginadoApi<AlertaStockApi>>(
    `/inventario/alertas${construirQueryString(filtros)}`,
  )
}
