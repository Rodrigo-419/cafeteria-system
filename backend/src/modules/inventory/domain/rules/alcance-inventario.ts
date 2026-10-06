// Regla de dominio: alcance sobre sucursales de inventario.
//
// El inventario es por sucursal. El Admin es central y entra a cualquiera; un
// Gerente o un Empleado, solo a la suya. Cuando la sucursal queda fuera del
// alcance la API responde 404 y no 403, para no revelar que existe.
//
// Es deny-by-default: un rol que no sea ninguno de los tres no accede a nada,
// ni siquiera a una sucursal "vacia".

import { NotFoundException } from '@nestjs/common';
import { esAdmin, esGerente, esEmpleado } from '../../../users/domain/roles';

/** Id centinela que no casa con ninguna sucursal real. */
export const SIN_ALCANCE = '__sin_alcance__';

/**
 * Recorte minimo del actor. No incluye los permisos efectivos: el
 * `PermissionsGuard` ya exigio el permiso correspondiente antes de llegar aqui.
 */
export type ActorInventario = {
  id: string;
  rol: string | null;
  sucursalId: string | null;
};

/** true si el actor puede operar sobre el inventario de esa sucursal. */
export function puedeAccederSucursal(
  actor: ActorInventario,
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
 * Exige acceso a la sucursal de la ruta.
 *
 * @throws NotFoundException (404) si queda fuera del alcance.
 */
export function exigirAccesoSucursal(
  actor: ActorInventario,
  sucursalId: string,
): void {
  if (!puedeAccederSucursal(actor, sucursalId)) {
    // 404 y no 403: un 403 confirmaria que la sucursal existe.
    throw new NotFoundException('La sucursal no existe');
  }
}

/**
 * Filtro de sucursal para los listados sin sucursal en la ruta.
 *
 * El Admin no filtra (undefined = todas). Un Gerente o Empleado queda atado a la
 * suya: si no pide nada, se le impone la suya; si pide la suya, se le respeta.
 *
 * Si pide una sucursal que no es la suya NO se le devuelve la suya en lugar de la
 * pedida. Un 200 con los datos de otra sucursal es peor que un error: el cliente
 * creeria que ha leido lo que pidio cuando en realidad no, y las alertas de
 * ninguna parte se confundiran. Se responde 404, igual que en el resto del
 * modulo, sin revelar si esa sucursal existe.
 *
 * Un rol desconocido recibe el centinela, que no casa con ninguna fila, para que
 * un listado sin filtro nunca le muestre el inventario entero.
 *
 * @throws NotFoundException (404) si pide una sucursal fuera de su alcance.
 */
export function filtroSucursalAlcance(
  actor: ActorInventario,
  sucursalPedida?: string,
): string | undefined {
  if (esAdmin(actor.rol)) {
    return sucursalPedida;
  }

  if ((esGerente(actor.rol) || esEmpleado(actor.rol)) && actor.sucursalId !== null) {
    // Se delega en el filtro de la ruta para no repetir el mensaje ni el criterio
    // de 404 en dos sitios.
    if (sucursalPedida !== undefined) {
      exigirAccesoSucursal(actor, sucursalPedida);
    }

    return actor.sucursalId;
  }

  return SIN_ALCANCE;
}
