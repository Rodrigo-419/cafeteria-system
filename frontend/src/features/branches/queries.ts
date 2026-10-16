// Consultas y mutaciones del módulo de sucursales (TanStack Query).
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import {
  actualizarSucursal,
  crearSucursal,
  listarSucursales,
  obtenerSucursal,
  type EntradaActualizarSucursal,
  type EntradaCrearSucursal,
} from '@/lib/api/branches'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import type { SucursalApi } from '@/types/api'

export const clavesSucursales = {
  todas: ['sucursales'] as const,
  detalle: (id: string) => ['sucursales', 'detalle', id] as const,
}

export function useSucursales() {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'sucursales.ver')
  return useQuery<SucursalApi[]>({
    queryKey: clavesSucursales.todas,
    queryFn: listarSucursales,
    enabled: permitido,
  })
}

export function useSucursal(id: string | null) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'sucursales.ver') && id !== null
  return useQuery<SucursalApi>({
    queryKey: clavesSucursales.detalle(id ?? ''),
    queryFn: () => {
      if (!id) throw new Error('Falta id')
      return obtenerSucursal(id)
    },
    enabled: permitido,
  })
}

export function useCrearSucursal(): UseMutationResult<
  SucursalApi,
  unknown,
  EntradaCrearSucursal
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearSucursal,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sucursales'] })
    },
  })
}

export function useActualizarSucursal(): UseMutationResult<
  SucursalApi,
  unknown,
  { id: string; entrada: EntradaActualizarSucursal }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, entrada }) => actualizarSucursal(id, entrada),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['sucursales'] })
      void queryClient.invalidateQueries({
        queryKey: clavesSucursales.detalle(variables.id),
      })
    },
  })
}

