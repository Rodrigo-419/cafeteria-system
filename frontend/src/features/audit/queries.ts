// Consultas del módulo de auditoría (TanStack Query).
//
// Ambas se habilitan solo con `usuarios.crear_editar`, el permiso que exigen las
// rutas del backend. El alcance (Admin/Gerente) lo aplica el servidor: aquí no
// se filtra nada por cliente.
import { useQuery } from '@tanstack/react-query'
import { listarSucursales } from '@/lib/api/branches'
import {
  historialAuditoriaUsuario,
  listarAuditoria,
  type FiltrosAuditoria,
} from '@/lib/api/auditoria'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import type { EventoAuditoriaApi, PaginaAuditoriaApi } from '@/types/api'

export const clavesAuditoria = {
  lista: (filtros: FiltrosAuditoria) => ['auditoria', 'lista', filtros] as const,
  historial: (usuarioId: string, paginacion: { page?: number; limit?: number }) =>
    ['auditoria', 'historial', usuarioId, paginacion] as const,
  sucursales: ['auditoria', 'sucursales'] as const,
}

/** Registro de auditoría visible para el usuario. Requiere `usuarios.crear_editar`. */
export function useAuditoria(filtros: FiltrosAuditoria) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'usuarios.crear_editar')

  return useQuery<PaginaAuditoriaApi<EventoAuditoriaApi>>({
    queryKey: clavesAuditoria.lista(filtros),
    queryFn: () => listarAuditoria(filtros),
    enabled: permitido,
    placeholderData: (anterior) => anterior,
  })
}

/**
 * Historial de un usuario. Requiere `usuarios.crear_editar` (la ruta lo exige
 * aunque el diálogo se abra con `permisos.asignar`). El 404 del backend se
 * trata como "no disponible" en el componente.
 */
export function useHistorialUsuario(
  usuarioId: string | null,
  paginacion: { page?: number; limit?: number } = {},
) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'usuarios.crear_editar')

  return useQuery<PaginaAuditoriaApi<EventoAuditoriaApi>>({
    queryKey: clavesAuditoria.historial(usuarioId ?? '', paginacion),
    queryFn: () =>
      historialAuditoriaUsuario(usuarioId as string, paginacion),
    enabled: permitido && usuarioId !== null,
  })
}

/** Sucursales para el filtro del Admin. Requiere `sucursales.ver`. */
export function useSucursalesAuditoria(habilitado: boolean) {
  const { permisos } = useAuth()
  const permitido = tienePermiso(permisos, 'sucursales.ver')

  return useQuery({
    queryKey: clavesAuditoria.sucursales,
    queryFn: listarSucursales,
    enabled: habilitado && permitido,
  })
}
