// Regla de dominio: alcance de lectura de asistencia.
//
// El Admin lee todo. Un Gerente lee solo los registros de su sucursal. Un
// Empleado lee solo los suyos. El alcance se aplica a registros, faltas,
// correcciones y justificaciones: cuando el objetivo queda fuera se responde
// 404 y no 403, para no revelar que existe.
import { esAdmin, esEmpleado, esGerente } from '../../../users/domain/roles';

/** Id centinela que no casa con ninguna sucursal real. */
export const SIN_ALCANCE_ASISTENCIA = '__sin_alcance_asistencia__';

/** Recorte minimo del actor tal y como lo ve la asistencia. */
export type ActorAsistencia = {
  id: string;
  rol: string | null;
  sucursalId: string | null;
};

/** Datos minimos del empleado objetivo para decidir el alcance. */
export type EmpleadoDeRegistro = {
  sucursalId: string;
  usuarioId: string;
};

/** true si el actor puede ver los registros del empleado objetivo. */
export function puedeVerRegistroAsistencia(
  actor: ActorAsistencia,
  objetivo: EmpleadoDeRegistro,
): boolean {
  if (esAdmin(actor.rol)) {
    return true;
  }

  if (esGerente(actor.rol)) {
    return actor.sucursalId !== null && objetivo.sucursalId === actor.sucursalId;
  }

  if (esEmpleado(actor.rol)) {
    return objetivo.usuarioId === actor.id;
  }

  return false;
}

/** true si el actor esta atado a una sucursal (necesaria para marcar). */
export function tieneSucursalAsistencia(actor: ActorAsistencia): boolean {
  return actor.sucursalId !== null;
}

/** Filtro de alcance que se combina con los filtros de un listado. */
export type AlcanceAsistencia = {
  sucursalId?: string;
  empleadoUsuarioId?: string;
};

/**
 * Filtro de alcance para listados: el Admin no filtra, el Gerente filtra por su
 * sucursal y el Empleado por su propio usuario. Un rol no reconocido recibe un
 * filtro imposible para que un listado nunca le entregue datos.
 */
export function filtroAlcanceAsistencia(
  actor: ActorAsistencia,
): AlcanceAsistencia {
  if (esAdmin(actor.rol)) {
    return {};
  }

  if (esGerente(actor.rol)) {
    return actor.sucursalId !== null
      ? { sucursalId: actor.sucursalId }
      : { sucursalId: SIN_ALCANCE_ASISTENCIA };
  }

  if (esEmpleado(actor.rol)) {
    return { empleadoUsuarioId: actor.id };
  }

  return { sucursalId: SIN_ALCANCE_ASISTENCIA };
}