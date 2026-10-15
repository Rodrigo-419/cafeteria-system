// Llamadas del módulo de auditoría contra el backend.
//
// Ambas rutas exigen `usuarios.crear_editar`. El alcance (Admin ve todo; el
// Gerente solo eventos que involucran usuarios o sucursales de su sucursal) lo
// decide el backend: el frontend no filtra nada por cliente. El listado admite
// filtros de entidad, acción, autor, sucursal y un rango de fechas locales
// limitado a 92 días; el historial de un usuario responde 404 si el usuario
// está fuera del alcance, sin revelar más.
import { peticionApi } from './client'
import { construirQueryString } from './query'
import type {
  AccionAuditoria,
  EntidadAuditoria,
  EventoAuditoriaApi,
  PaginaAuditoriaApi,
} from '@/types/api'

export interface FiltrosAuditoria {
  page?: number
  /** El backend lo limita a 100; valores mayores responden 400. */
  limit?: number
  actorId?: string
  entidad?: EntidadAuditoria
  entidadId?: string
  accion?: AccionAuditoria
  sucursalId?: string
  /** Día local "AAAA-MM-DD"; el rango con `hasta` no puede superar 92 días. */
  desde?: string
  hasta?: string
}

/** `GET /api/auditoria`: listado paginado dentro del alcance. */
export function listarAuditoria(
  filtros: FiltrosAuditoria = {},
): Promise<PaginaAuditoriaApi<EventoAuditoriaApi>> {
  return peticionApi<PaginaAuditoriaApi<EventoAuditoriaApi>>(
    `/auditoria${construirQueryString(filtros)}`,
  )
}

/** `GET /api/auditoria/usuarios/:usuarioId`: historial de un usuario. */
export function historialAuditoriaUsuario(
  usuarioId: string,
  paginacion: { page?: number; limit?: number } = {},
): Promise<PaginaAuditoriaApi<EventoAuditoriaApi>> {
  return peticionApi<PaginaAuditoriaApi<EventoAuditoriaApi>>(
    `/auditoria/usuarios/${encodeURIComponent(usuarioId)}${construirQueryString(paginacion)}`,
  )
}
