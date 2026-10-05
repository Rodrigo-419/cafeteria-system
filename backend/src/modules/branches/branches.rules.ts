// Reglas de dominio de sucursales: quien puede ver cual y como se comparan los
// nombres.
//
// Son funciones puras y NO dependen de Nest ni de Prisma, para que la decision de
// visibilidad se pueda probar sola. El servicio solo las consulta.

import { esAdmin, esEmpleado, esGerente } from '../users/domain/roles';

/**
 * Identificador imposible que se usa como filtro cuando el actor no tiene
 * sucursal asignada (un Gerente o Empleado nunca deberia, pero el dato puede
 * faltar). Mismo truco que `filtroAlcanceListado` del modulo users: en lugar de
 * devolver "trae todas" por accidente, el filtro no casa con ninguna fila.
 */
export const SIN_ALCANCE = '__sin_alcance__';

/**
 * Recorte minimo del actor que necesitan estas reglas. Es un subconjunto de
 * `request.user` y de `Actor` (modulo users) a proposito: la regla no depende
 * de los permisos efectivos, porque el permiso `sucursales.ver` ya lo exige el
 * `PermissionsGuard` antes de llegar aqui.
 */
export type ActorSucursales = {
  id: string;
  rol: string | null;
  sucursalId: string | null;
};

/**
 * true si el actor puede ver la sucursal indicada.
 *
 * El Admin ve todas porque es central. Un Gerente o un Empleado solo ve la suya:
 * el resto le responde 404, no 403, para no revelar que esa sucursal existe.
 *
 * Cualquier rol que no sea uno de los tres conocidos no ve nada. Es una decision
 * deliberada: si mañana se añade un rol nuevo sin tocar esta funcion, no obtiene
 * acceso por accidente.
 */
export function puedeVerSucursal(
  actor: ActorSucursales,
  sucursalId: string,
): boolean {
  if (esAdmin(actor.rol)) {
    return true;
  }

  if (!esGerente(actor.rol) && !esEmpleado(actor.rol)) {
    return false;
  }

  return actor.sucursalId !== null && actor.sucursalId === sucursalId;
}

/**
 * Filtro para el listado: `undefined` significa "sin filtro" (Admin, todas).
 * Para el resto devuelve el id de su unica sucursal visible.
 */
export function filtroSucursalesVisibles(
  actor: ActorSucursales,
): { sucursalId: string } | undefined {
  if (esAdmin(actor.rol)) {
    return undefined;
  }

  return { sucursalId: actor.sucursalId ?? SIN_ALCANCE };
}

/**
 * Forma en la que se comparan dos nombres de sucursal.
 *
 * "Sucursal  Centro", "  sucursal centro " y "SUCURSAL CENTRO" son la misma
 * sucursal. Se recortan los espacios de los extremos, se reducen las
 * separaciones internas a un unico espacio y se pasa a minusculas.
 */
export function normalizarNombreSucursal(nombre: string): string {
  return nombre.trim().replace(/\s+/gu, ' ').toLowerCase();
}

/** true si dos nombres de sucursal son el mismo nombre a efectos de unicidad. */
export function mismoNombreSucursal(a: string, b: string): boolean {
  return normalizarNombreSucursal(a) === normalizarNombreSucursal(b);
}
