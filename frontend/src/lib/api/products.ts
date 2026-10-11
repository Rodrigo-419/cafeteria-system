// Llamadas del catálogo global de productos (categorías, variantes y
// productos) y del precio por sucursal (la carta).
//
// Rutas y permisos según `docs/referencia-api.md`: el catálogo lo edita el Admin
// (`productos.catalogo.editar`) y los precios por sucursal solo el Gerente
// (`productos.precio.editar`).
import { peticionApi } from './client'
import { construirQueryString } from './query'
import type {
  CategoriaProductoApi,
  EstadoOferta,
  OfertaRespuestaApi,
  PaginadoApi,
  ProductoApi,
  VarianteApi,
} from '@/types/api'

export interface FiltrosProductos {
  page?: number
  limit?: number
  categoriaId?: string
  q?: string
}

export interface EntradaProducto {
  nombre: string
  categoriaId: string
  descripcion?: string | null
}

// ---------------------------------------------------------------- productos

/** `GET /api/products`: catálogo global paginado con filtro y búsqueda. */
export function listarProductos(
  filtros: FiltrosProductos = {},
): Promise<PaginadoApi<ProductoApi>> {
  return peticionApi<PaginadoApi<ProductoApi>>(
    `/products${construirQueryString(filtros)}`,
  )
}

/** `POST /api/products`: crea un producto en una categoría. */
export function crearProducto(entrada: EntradaProducto): Promise<ProductoApi> {
  return peticionApi<ProductoApi>('/products', { method: 'POST', body: entrada })
}

/** `PATCH /api/products/:id`: edición parcial de un producto. */
export function actualizarProducto(
  id: string,
  entrada: EntradaProducto,
): Promise<ProductoApi> {
  return peticionApi<ProductoApi>(`/products/${id}`, {
    method: 'PATCH',
    body: entrada,
  })
}

/** `DELETE /api/products/:id`: borra un producto sin precios (409 si los tiene). */
export function eliminarProducto(id: string): Promise<void> {
  return peticionApi<void>(`/products/${id}`, { method: 'DELETE' })
}

// --------------------------------------------------------------- categorías

/** `GET /api/product-categories`: lista las categorías. */
export function listarCategorias(): Promise<CategoriaProductoApi[]> {
  return peticionApi<CategoriaProductoApi[]>('/product-categories')
}

/** `POST /api/product-categories`: crea una categoría (409 si el nombre repite). */
export function crearCategoria(nombre: string): Promise<CategoriaProductoApi> {
  return peticionApi<CategoriaProductoApi>('/product-categories', {
    method: 'POST',
    body: { nombre },
  })
}

/** `PATCH /api/product-categories/:id`: renombra una categoría. */
export function actualizarCategoria(
  id: string,
  nombre: string,
): Promise<CategoriaProductoApi> {
  return peticionApi<CategoriaProductoApi>(`/product-categories/${id}`, {
    method: 'PATCH',
    body: { nombre },
  })
}

/** `DELETE /api/product-categories/:id`: borra una categoría vacía (409 si no). */
export function eliminarCategoria(id: string): Promise<void> {
  return peticionApi<void>(`/product-categories/${id}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------- variantes

/** `GET /api/variants`: lista las variantes del catálogo. */
export function listarVariantes(): Promise<VarianteApi[]> {
  return peticionApi<VarianteApi[]>('/variants')
}

/** `POST /api/variants`: crea una variante (409 si el nombre repite). */
export function crearVariante(nombre: string): Promise<VarianteApi> {
  return peticionApi<VarianteApi>('/variants', {
    method: 'POST',
    body: { nombre },
  })
}

/** `PATCH /api/variants/:id`: renombra una variante (la base "Única" da 409). */
export function actualizarVariante(
  id: string,
  nombre: string,
): Promise<VarianteApi> {
  return peticionApi<VarianteApi>(`/variants/${id}`, {
    method: 'PATCH',
    body: { nombre },
  })
}

/** `DELETE /api/variants/:id`: borra una variante sin precios (409 si no). */
export function eliminarVariante(id: string): Promise<void> {
  return peticionApi<void>(`/variants/${id}`, { method: 'DELETE' })
}

// --------------------------------------------------------- carta / precios

export interface EntradaOferta {
  sucursalId: string
  productoId: string
  varianteId: string
  /** Precio como número; el backend lo serializa a decimal con dos dígitos. */
  precio: number
  estado?: EstadoOferta
}

/**
 * `PUT /api/branches/:sucursalId/products/:productoId/variants/:varianteId`:
 * crea o actualiza el precio y el estado de una variante en una sucursal.
 *
 * El upsert es de alcance del Gerente: fuera de su sucursal responde 404 (no se
 * revela que ahí haya precios).
 */
export function actualizarOferta({
  sucursalId,
  productoId,
  varianteId,
  precio,
  estado,
}: EntradaOferta): Promise<OfertaRespuestaApi> {
  return peticionApi<OfertaRespuestaApi>(
    `/branches/${sucursalId}/products/${productoId}/variants/${varianteId}`,
    { method: 'PUT', body: { precio, estado } },
  )
}
