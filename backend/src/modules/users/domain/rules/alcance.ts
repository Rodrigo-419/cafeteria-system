// Regla de dominio: alcance de gestión sobre usuarios.
//
// Un Admin gestiona a cualquier usuario. Un Gerente solo gestiona a usuarios
// con rol Empleado de su propia sucursal. Cuando el objetivo queda fuera del
// alcance la API responde 404 y no 403, para no revelar que el usuario existe.

import { esAdmin, esGerente, ROL_EMPLEADO } from '../roles';

/**
 * Actor que ejecuta la accion. Es un recorte minimo de `request.user` para que
 * estas funciones puras no dependan de Nest ni de la forma de la peticion.
 */
export type Actor = {
  id: string;
  rol: string | null;
  sucursalId: string | null;
  permisosEfectivos: readonly string[];
};

/** Datos minimos del usuario objetivo necesarios para decidir el alcance. */
export type ObjetivoAlcance = {
  id: string;
  rol: string | null;
  sucursalId: string | null;
};

/**
 * true si el actor puede ver y gestionar al usuario objetivo.
 * Un Gerente nunca alcanza a otro Gerente ni a un Admin, aunque compartan
 * sucursal, porque solo gestiona Empleados.
 */
export function puedeGestionarUsuario(
  actor: Actor,
  objetivo: ObjetivoAlcance,
): boolean {
  if (esAdmin(actor.rol)) {
    return true;
  }

  if (esGerente(actor.rol)) {
    return (
      objetivo.rol === ROL_EMPLEADO &&
      actor.sucursalId !== null &&
      objetivo.sucursalId === actor.sucursalId
    );
  }

  // Empleados (y cualquier rol no reconocido) no gestionan usuarios.
  return false;
}

/**
 * Filtro de alcance para listados: el Admin no filtra, el Gerente queda
 * limitado a los Empleados de su sucursal.
 */
export function filtroAlcanceListado(
  actor: Actor,
): { sucursalId?: string; rol?: string } | undefined {
  if (esAdmin(actor.rol)) {
    return undefined;
  }

  if (esGerente(actor.rol) && actor.sucursalId !== null) {
    return { sucursalId: actor.sucursalId, rol: ROL_EMPLEADO };
  }

  // Sin alcance: se devuelve un filtro imposible para no filtrar nada.
  return { sucursalId: '__sin_alcance__', rol: '__sin_alcance__' };
}