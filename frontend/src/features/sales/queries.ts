// Consultas y mutaciones de ventas (TanStack Query).
//
// Cada consulta se habilita solo con el permiso real que exige su ruta:
// `ventas.ver` para listar y ver el detalle, `productos.ver` para la carta y
// `ventas.registrar`/`ventas.anular` para las mutaciones. Así el frontend nunca
// llama a una ruta para la que no tiene permiso.
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { listarCarta, listarSucursales } from '@/lib/api/branches'
import {
  anularVenta,
  listarVentas,
  obtenerVenta,
  registrarVenta,
  type FiltrosVentas,
  type RegistrarVentaEntrada,
} from '@/lib/api/sales'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import type { VentaCompletaApi } from '@/types/api'

export const clavesVentas = {
  lista: (filtros: FiltrosVentas) => ['ventas', 'lista', filtros] as const,
  detalle: (id: string) => ['ventas', 'detalle', id] as const,
  carta: (sucursalId: string | null) => ['ventas', 'carta', sucursalId] as const,
  sucursales: ['ventas', 'sucursales'] as const,
}

/** Carta de la sucursal del usuario. Requiere `productos.ver`. */
export function useCarta(sucursalId: string | null) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'productos.ver')

  return useQuery({
    queryKey: clavesVentas.carta(sucursalId),
    queryFn: () => {
      if (!sucursalId) {
        throw new Error('El usuario no tiene sucursal')
      }
      return listarCarta(sucursalId)
    },
    enabled: sucursalId !== null && permitido,
  })
}

/** Listado de sucursales para el filtro del Admin. Requiere `sucursales.ver`. */
export function useSucursales(habilitado: boolean) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'sucursales.ver')

  return useQuery({
    queryKey: clavesVentas.sucursales,
    queryFn: listarSucursales,
    enabled: habilitado && permitido,
  })
}

/** Ventas con paginado y filtros. Requiere `ventas.ver`. */
export function useVentas(filtros: FiltrosVentas) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'ventas.ver')

  return useQuery({
    queryKey: clavesVentas.lista(filtros),
    queryFn: () => listarVentas(filtros),
    enabled: permitido,
    placeholderData: (anterior) => anterior,
  })
}

/** Detalle de una venta. Requiere `ventas.ver`. */
export function useVenta(id: string | undefined) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'ventas.ver')

  return useQuery({
    queryKey: clavesVentas.detalle(id ?? ''),
    queryFn: () => {
      if (!id) {
        throw new Error('Falta el id de la venta')
      }
      return obtenerVenta(id)
    },
    enabled: permitido && Boolean(id),
  })
}

/** Registra una venta e invalida los listados afectados. */
export function useRegistrarVenta(): UseMutationResult<
  VentaCompletaApi,
  unknown,
  RegistrarVentaEntrada
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: registrarVenta,
    onSuccess: (venta) => {
      queryClient.invalidateQueries({ queryKey: ['ventas', 'lista'] })
      queryClient.setQueryData(clavesVentas.detalle(venta.id), venta)
    },
  })
}

/** Anula una venta e invalida el listado y su detalle. */
export function useAnularVenta(): UseMutationResult<
  VentaCompletaApi,
  unknown,
  { id: string; motivo: string }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, motivo }) => anularVenta(id, motivo),
    onSuccess: (venta) => {
      queryClient.invalidateQueries({ queryKey: ['ventas', 'lista'] })
      queryClient.setQueryData(clavesVentas.detalle(venta.id), venta)
    },
  })
}
