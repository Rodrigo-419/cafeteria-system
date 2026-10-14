// Modelo de dominio de la auditoria.
//
// Un evento describe QUE cambio (entidad + accion), QUIEN lo hizo (actor) y a
// QUIEN o a QUE sucursal afecto. El detalle guarda los valores antes/despues,
// siempre saneados: nunca lleva contrasenas, hashes ni PIN.
import type {
  AuditoriaAccion,
  AuditoriaEntidad,
} from '../../../generated/prisma/client';

/** Entidad afectada por un evento. Se reutiliza el enum de Prisma. */
export type EntidadAuditoria = AuditoriaEntidad;

/** Accion registrada. Se reutiliza el enum de Prisma. */
export type AccionAuditoria = AuditoriaAccion;

/** Cambios antes/despues de una operacion. Puede llevar cualquier campo salvo secretos. */
export type DetalleAuditoria = {
  antes?: unknown;
  despues?: unknown;
};

/**
 * Evento listo para persistir.
 *
 * `usuarioAfectadoId` solo se usa en eventos de usuario, permiso y empleado
 * (en el cese/alta de empleado apunta al usuario vinculado). `sucursalAfectadaId`
 * queda en null en los eventos globales (catalogo de productos, categorias,
 * variantes, insumos, sucursales).
 */
export type EventoAuditoria = {
  entidad: EntidadAuditoria;
  entidadId: string;
  accion: AccionAuditoria;
  actorId: string;
  usuarioAfectadoId?: string | null;
  sucursalAfectadaId?: string | null;
  detalle?: DetalleAuditoria | null;
};
