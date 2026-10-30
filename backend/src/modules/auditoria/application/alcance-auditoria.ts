// Alcance de lectura de la auditoria, derivado del rol del actor.
//
//   * Admin  -> ve todo.
//   * Gerente -> solo eventos de personas (usuario/empleado) cuyo usuario
//     afectado sea un Empleado de SU sucursal, eventos operativos de SU
//     sucursal y SUS PROPIAS exportaciones. Los eventos globales (catalogo) y
//     las exportaciones de otros usuarios no los ve.
//   * Cualquier otro rol -> sin acceso.
import { esAdmin, esGerente } from '../../users/domain/roles';
import type { AlcanceAuditoria } from '../infrastructure/auditoria.repository';

/** Recorte minimo del actor que basta para decidir el alcance. */
export type ActorAuditoria = {
  id: string;
  rol: string | null;
  sucursalId: string | null;
};

/** Devuelve el alcance del actor, o null si no puede leer la auditoria. */
export function alcanceDeActor(
  actor: ActorAuditoria,
): AlcanceAuditoria | null {
  if (esAdmin(actor.rol)) {
    return { tipo: 'global' };
  }

  if (esGerente(actor.rol) && actor.sucursalId !== null) {
    return {
      tipo: 'sucursal',
      sucursalId: actor.sucursalId,
      actorId: actor.id,
    };
  }

  return null;
}
