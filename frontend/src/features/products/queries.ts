// Consultas y mutaciones del catálogo de productos (TanStack Query).
//
// Cada consulta se habilita solo con el permiso real que exige su ruta:
// `productos.ver` para catálogo y carta; las mutaciones de catálogo se invocan
// solo desde acciones visibles con `productos.catalogo.editar`, y el precio solo
// con `productos.precio.editar`. El backend sigue siendo la autoridad.
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { listarCarta, listarSucursales } from '@/lib/api/branches'
import {
  actualizarCategoria,
  actualizarOferta,
  actualizarProducto,
  actualizarVariante,
  crearCategoria,
  crearProducto,
  crearVariante,
  eliminarCategoria,
  eliminarProducto,
  eliminarVariante,
  listarCategorias,
  listarProductos,
  listarVariantes,
  type EntradaOferta,
  type EntradaProducto,
  type FiltrosProductos,
} from '@/lib/api/products'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import type {
  CategoriaProductoApi,
  EstadoOferta,
  OfertaRespuestaApi,
  ProductoApi,
  VarianteApi,
} from '@/types/api'

export const clavesProductos = {
  catalogo: (filtros: FiltrosProductos) =>
    ['productos', 'catalogo', filtros] as const,
  categorias: ['productos', 'categorias'] as const,
  variantes: ['productos', 'variantes'] as const,
  carta: (sucursalId: string | null, estado: EstadoOferta | 'todas') =>
    ['productos', 'carta', sucursalId, estado] as const,
  sucursales: ['productos', 'sucursales'] as const,
}

/** Catálogo global paginado. Requiere `productos.ver`. */
export function useProductos(filtros: FiltrosProductos) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'productos.ver')

  return useQuery({
    queryKey: clavesProductos.catalogo(filtros),
    queryFn: () => listarProductos(filtros),
    enabled: permitido,
    placeholderData: (anterior) => anterior,
  })
}

/** Categorías del catálogo. Requiere `productos.ver`. */
export function useCategorias() {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'productos.ver')

  return useQuery({
    queryKey: clavesProductos.categorias,
    queryFn: listarCategorias,
    enabled: permitido,
  })
}

/** Variantes del catálogo. Requiere `productos.ver`. */
export function useVariantes() {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'productos.ver')

  return useQuery({
    queryKey: clavesProductos.variantes,
    queryFn: listarVariantes,
    enabled: permitido,
  })
}

/** Carta de una sucursal. Requiere `productos.ver` y una sucursal elegida. */
export function useCartaSucursal(
  sucursalId: string | null,
  estado: EstadoOferta | 'todas',
) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'productos.ver')

  return useQuery({
    queryKey: clavesProductos.carta(sucursalId, estado),
    queryFn: () => {
      if (!sucursalId) {
        throw new Error('Falta la sucursal')
      }
      return listarCarta(sucursalId, estado === 'todas' ? undefined : estado)
    },
    enabled: permitido && sucursalId !== null,
  })
}

/** Sucursales para que el Admin elija la carta a consultar. */
export function useSucursales(habilitado: boolean) {
  return useQuery({
    queryKey: clavesProductos.sucursales,
    queryFn: listarSucursales,
    enabled: habilitado,
  })
}

function invalidarCatalogo(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: ['productos', 'catalogo'] })
}

// ------------------------------------------------------------------ productos

/** Crea un producto e invalida el catálogo. */
export function useCrearProducto(): UseMutationResult<
  ProductoApi,
  unknown,
  EntradaProducto
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearProducto,
    onSuccess: () => invalidarCatalogo(queryClient),
  })
}

/** Edita un producto e invalida el catálogo. */
export function useActualizarProducto(): UseMutationResult<
  ProductoApi,
  unknown,
  { id: string; entrada: EntradaProducto }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, entrada }) => actualizarProducto(id, entrada),
    onSuccess: () => invalidarCatalogo(queryClient),
  })
}

/** Borra un producto e invalida el catálogo. */
export function useEliminarProducto(): UseMutationResult<
  void,
  unknown,
  string
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: eliminarProducto,
    onSuccess: () => invalidarCatalogo(queryClient),
  })
}

// ------------------------------------------------------------------ categorías

/** Crea una categoría e invalida categorías y catálogo. */
export function useCrearCategoria(): UseMutationResult<
  CategoriaProductoApi,
  unknown,
  string
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearCategoria,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clavesProductos.categorias })
      invalidarCatalogo(queryClient)
    },
  })
}

/** Renombra una categoría e invalida categorías y catálogo. */
export function useActualizarCategoria(): UseMutationResult<
  CategoriaProductoApi,
  unknown,
  { id: string; nombre: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, nombre }) => actualizarCategoria(id, nombre),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clavesProductos.categorias })
      invalidarCatalogo(queryClient)
    },
  })
}

/** Borra una categoría e invalida categorías y catálogo. */
export function useEliminarCategoria(): UseMutationResult<
  void,
  unknown,
  string
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: eliminarCategoria,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clavesProductos.categorias })
      invalidarCatalogo(queryClient)
    },
  })
}

// ------------------------------------------------------------------ variantes

/** Crea una variante e invalida variantes. */
export function useCrearVariante(): UseMutationResult<
  VarianteApi,
  unknown,
  string
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearVariante,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: clavesProductos.variantes }),
  })
}

/** Renombra una variante e invalida variantes. */
export function useActualizarVariante(): UseMutationResult<
  VarianteApi,
  unknown,
  { id: string; nombre: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, nombre }) => actualizarVariante(id, nombre),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: clavesProductos.variantes }),
  })
}

/** Borra una variante e invalida variantes. */
export function useEliminarVariante(): UseMutationResult<void, unknown, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: eliminarVariante,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: clavesProductos.variantes }),
  })
}

// -------------------------------------------------------------- carta/precio

/** Crea o actualiza un precio e invalida la carta de todas las sucursales. */
export function useActualizarOferta(): UseMutationResult<
  OfertaRespuestaApi,
  unknown,
  EntradaOferta
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: actualizarOferta,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['productos', 'carta'] }),
  })
}
