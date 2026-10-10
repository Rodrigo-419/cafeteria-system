// Regla de dominio: alcance de gestion sobre turnos y asignaciones.
//
// Un Admin gestiona todos los turnos y todas las asignaciones. Un Gerente solo
// gestiona los turnos de su sucursal y, en asignaciones, solo las de empleados
// cuyo usuario vinculado tiene rol Empleado en su sucursal. Cuando el objetivo
// queda fuera del alcance la API responde 404 y no 403, para no revelar que
// existe.
//
// El alcance sobre empleados se reutiliza tal cual del modulo de personal: es la
// misma regla ("Empleado de mi sucursal") y no deberia tener dos definiciones.
import {
  filtroAlcanceEmpleados,
  type ActorEmpleados,
  type AlcanceEmpleados,
} from '../../../employees/domain/rules/alcance';
import { esAdmin, esGerente } from '../../../users/domain/roles';

/** Id centinela que no casa con ninguna sucursal real. */
export const SIN_ALCANCE_TURNOS = '__sin_alcance_turnos__';

/** Recorte minimo del actor para las reglas de turnos. */
export type ActorTurnos = ActorEmpleados;

/** Filtro de alcance sobre turnos, que solo dependen de la sucursal. */
export type AlcanceTurnos = {
  sucursalId?: string;
};

/**
 * Filtro de alcance para listados y busquedas de turnos: el Admin no filtra y
 * el Gerente queda limitado a su sucursal. Un rol no reconocido recibe un filtro
 * imposible para que un listado sin filtro nunca le entregue todos los turnos.
 */
export function filtroAlcanceTurnos(
  actor: ActorTurnos,
): AlcanceTurnos | undefined {
  if (esAdmin(actor.rol)) {
    return undefined;
  }

  if (esGerente(actor.rol) && actor.sucursalId !== null) {
    return { sucursalId: actor.sucursalId };
  }

  return { sucursalId: SIN_ALCANCE_TURNOS };
}

/** Filtro de alcance sobre empleados para las asignaciones. */
export function alcanceEmpleadosParaAsignaciones(
  actor: ActorTurnos,
): AlcanceEmpleados | undefined {
  return filtroAlcanceEmpleados(actor);
}

/** true si el actor puede crear turnos (Admin, o Gerente con sucursal). */
export function puedeGestionarTurnos(actor: ActorTurnos): boolean {
  return esAdmin(actor.rol) || (esGerente(actor.rol) && actor.sucursalId !== null);
}
