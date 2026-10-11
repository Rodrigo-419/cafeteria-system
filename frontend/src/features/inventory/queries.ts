// Consultas y mutaciones del inventario (TanStack Query).
//
// Cada consulta se habilita solo con el permiso real que exige su ruta:
// `insumos.ver` para el catálogo y el stock; `alertas.ver_resolver` para las
// alertas. Las mutaciones se invocan solo desde acciones visibles con
// `insumos.catalogo.editar`, `inventario.minimo.editar` o
// `inventario.registrar`. El backend sigue siendo la autoridad.
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { listarSucursales } from '@/lib/api/branches'
import {
  actualizarInsumo,
  configurarStock,
  crearInsumo,
  eliminarInsumo,
  listarAlertas,
  listarInsumos,
  listarStock,
  registrarEntrada,
  type EntradaConfigurarStock,
  type EntradaInsumo,
  type EntradaRegistrarEntrada,
  type FiltrosAlertas,
  type FiltrosInsumos,
  type FiltrosStock,
} from '@/lib/api/inventory'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import type {
  InsumoApi,
  ResultadoEntradaApi,
  StockInsumoApi,
} from '@/types/api'

/** Tope del resumen: el backend acepta hasta 100 por página. */
export const LIMITE_RESUMEN = 100

export const clavesInventario = {
  insumos: (filtros: FiltrosInsumos) =>
    ['inventario', 'insumos', filtros] as const,
  stock: (sucursalId: string | null, filtros: FiltrosStock) =>
    ['inventario', 'stock', sucursalId, filtros] as const,
  resumenStock: (sucursalId: string | null) =>
    ['inventario', 'stock-resumen', sucursalId] as const,
  alertas: (filtros: FiltrosAlertas) =>
    ['inventario', 'alertas', filtros] as const,
  sucursales: ['inventario', 'sucursales'] as const,
}

// ------------------------------------------------------------------ insumos

/** Catálogo global de insumos. Requiere `insumos.ver`. */
export function useInsumos(filtros: FiltrosInsumos) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'insumos.ver')

  return useQuery({
    queryKey: clavesInventario.insumos(filtros),
    queryFn: () => listarInsumos(filtros),
    enabled: permitido,
    placeholderData: (anterior) => anterior,
  })
}

/** Todos los insumos del catálogo (para selectores). Requiere `insumos.ver`. */
export function useInsumosDisponibles() {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'insumos.ver')

  return useQuery({
    queryKey: clavesInventario.insumos({ limit: LIMITE_RESUMEN }),
    queryFn: () => listarInsumos({ limit: LIMITE_RESUMEN }),
    enabled: permitido,
  })
}

function invalidarInsumos(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: ['inventario', 'insumos'] })
}

/** Crea un insumo e invalida el catálogo. */
export function useCrearInsumo(): UseMutationResult<
  InsumoApi,
  unknown,
  EntradaInsumo
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearInsumo,
    onSuccess: () => invalidarInsumos(queryClient),
  })
}

/** Edita un insumo e invalida el catálogo. */
export function useActualizarInsumo(): UseMutationResult<
  InsumoApi,
  unknown,
  { id: string; entrada: Partial<EntradaInsumo> }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, entrada }) => actualizarInsumo(id, entrada),
    onSuccess: () => invalidarInsumos(queryClient),
  })
}

/** Borra un insumo e invalida el catálogo. */
export function useEliminarInsumo(): UseMutationResult<void, unknown, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: eliminarInsumo,
    onSuccess: () => invalidarInsumos(queryClient),
  })
}

// -------------------------------------------------------------------- stock

/** Stock de una sucursal. Requiere `insumos.ver` y una sucursal elegida. */
export function useStock(sucursalId: string | null, filtros: FiltrosStock) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'insumos.ver')

  return useQuery({
    queryKey: clavesInventario.stock(sucursalId, filtros),
    queryFn: () => {
      if (!sucursalId) {
        throw new Error('Falta la sucursal')
      }
      return listarStock(sucursalId, filtros)
    },
    enabled: permitido && sucursalId !== null,
    placeholderData: (anterior) => anterior,
  })
}

/**
 * Resumen para los KPI: total de insumos dados de alta y cuántos están bajo el
 * mínimo. Se apoya en dos consultas de una sola fila (`limit: 1`) para leer el
 * `total` de cada filtro sin traer la lista completa.
 */
export function useResumenStock(sucursalId: string | null) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'insumos.ver')
  const habilitado = permitido && sucursalId !== null

  const total = useQuery({
    queryKey: clavesInventario.resumenStock(sucursalId),
    queryFn: () => listarStock(sucursalId as string, { page: 1, limit: 1 }),
    enabled: habilitado,
  })

  const bajoMinimo = useQuery({
    queryKey: [
      ...clavesInventario.resumenStock(sucursalId),
      'bajo-minimo',
    ] as const,
    queryFn: () =>
      listarStock(sucursalId as string, {
        page: 1,
        limit: 1,
        soloBajoMinimo: true,
      }),
    enabled: habilitado,
  })

  return {
    total: total.data?.total ?? null,
    bajoMinimo: bajoMinimo.data?.total ?? null,
    isLoading: total.isLoading || bajoMinimo.isLoading,
    error: total.error ?? bajoMinimo.error ?? null,
    refetch: () => {
      void total.refetch()
      void bajoMinimo.refetch()
    },
  }
}

function invalidarStock(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['inventario', 'stock'] })
  void queryClient.invalidateQueries({
    queryKey: ['inventario', 'stock-resumen'],
  })
  // Cambiar el stock abre o cierra alertas: refresca el listado del módulo y los
  // bloques del panel de control que cuentan alertas (listado propio y columna
  // "Alertas" del comparativo de sucursales).
  void queryClient.invalidateQueries({ queryKey: ['inventario', 'alertas'] })
  void queryClient.invalidateQueries({ queryKey: ['dashboard', 'alertas-abiertas'] })
  void queryClient.invalidateQueries({ queryKey: ['dashboard', 'reporte'] })
}

/** Da de alta o ajusta el stock mínimo/estado de un insumo en una sucursal. */
export function useConfigurarStock(): UseMutationResult<
  StockInsumoApi,
  unknown,
  { sucursalId: string; insumoId: string; entrada: EntradaConfigurarStock }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sucursalId, insumoId, entrada }) =>
      configurarStock(sucursalId, insumoId, entrada),
    onSuccess: () => invalidarStock(queryClient),
  })
}

/** Registra una entrada de stock y devuelve la fila actualizada. */
export function useRegistrarEntrada(): UseMutationResult<
  ResultadoEntradaApi,
  unknown,
  { sucursalId: string; insumoId: string; entrada: EntradaRegistrarEntrada }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sucursalId, insumoId, entrada }) =>
      registrarEntrada(sucursalId, insumoId, entrada),
    onSuccess: () => invalidarStock(queryClient),
  })
}

// ------------------------------------------------------------------ alertas

/** Alertas de stock (solo lectura). Requiere `alertas.ver_resolver`. */
export function useAlertas(filtros: FiltrosAlertas) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'alertas.ver_resolver')

  return useQuery({
    queryKey: clavesInventario.alertas(filtros),
    queryFn: () => listarAlertas(filtros),
    enabled: permitido,
    placeholderData: (anterior) => anterior,
  })
}

/** Sucursales para que el Admin elija dónde mirar el inventario. */
export function useSucursales(habilitado: boolean) {
  return useQuery({
    queryKey: clavesInventario.sucursales,
    queryFn: listarSucursales,
    enabled: habilitado,
  })
}
