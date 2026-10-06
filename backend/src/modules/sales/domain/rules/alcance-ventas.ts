// Regla de dominio: alcance sobre sucursales de las ventas.
//
// Una venta siempre pertenece a una sucursal y se registra desde la sucursal en
// la que esta el cajero, nunca desde una elegida en la peticion. El Admin es
// central y consulta cualquiera; un Gerente o un Empleado, solo la suya.
//
// Cuando la sucursal queda fuera del alcance la API responde 404 y no 403, para
// no revelar que existe. La excepcion es registrar: ahi no hay sucursal que
// ocultar, el usuario simplemente no tiene ninguna, y responder 404 seria
// mentir sobre el error (403).

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { esAdmin, esEmpleado, esGerente } from '../../../users/domain/roles';

/** Id centinela que no casa con ninguna sucursal real. */
export const SIN_ALCANCE = '__sin_alcance__';

/**
 * Recorte minimo del actor. No incluye los permisos efectivos: el
 * `PermissionsGuard` ya exigi `ventas.registrar`, `ventas.anular` o
 * `ventas.ver` antes de llegar aqui.
 */
export type ActorVentas = {
  id: string;
  rol: string | null;
  sucursalId: string | null;
};

/** true si el actor puede leer las ventas de esa sucursal. */
export function puedeAccederSucursal(
  actor: ActorVentas,
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
 * Sucursal en la que el actor registra ventas.
 *
 * La venta no lleva sucursal en el cuerpo: se toma de `request.user`. Un actor
 * sin sucursal (el Admin, que es central) no puede vender en ninguna, y eso es
 * un 403, no un 404: no se esta pidiendo un recurso que no exista, sino
 * realizar una operacion que el actor no puede hacer.
 *
 * @throws ForbiddenException (403) si el actor no tiene sucursal.
 */
export function exigirSucursalDeRegistro(actor: ActorVentas): string {
  if (actor.sucursalId === null || actor.sucursalId === '') {
    throw new ForbiddenException('El usuario no tiene sucursal asignada');
  }

  return actor.sucursalId;
}

/**
 * Exige que el actor pueda ver una venta de esa sucursal.
 *
 * @param mensaje mensaje del 404, para que cada ruta responda hablando del
 * recurso que se pidio (la venta, no la sucursal).
 * @throws NotFoundException (404) si queda fuera del alcance.
 */
export function exigirAccesoSucursal(
  actor: ActorVentas,
  sucursalId: string,
  mensaje = 'La sucursal no existe',
): void {
  if (!puedeAccederSucursal(actor, sucursalId)) {
    // 404 y no 403: un 403 confirmaria que la sucursal o la venta existe.
    throw new NotFoundException(mensaje);
  }
}

/**
 * Filtro de sucursal para el listado de ventas.
 *
 * El Admin no filtra (undefined = todas). Un Gerente o un Empleado queda atado a
 * la suya: si no pide nada, se le impone la suya; si pide otra, responde 404 sin
 * revelar si existe.
 *
 * Un rol desconocido recibe el centinela, que no casa con ninguna fila, para que
 * un listado sin filtro nunca le venda el historial entero.
 *
 * @throws NotFoundException (404) si pide una sucursal fuera de su alcance.
 */
export function filtroSucursalAlcance(
  actor: ActorVentas,
  sucursalPedida?: string,
): string | undefined {
  if (esAdmin(actor.rol)) {
    return sucursalPedida;
  }

  if ((esGerente(actor.rol) || esEmpleado(actor.rol)) && actor.sucursalId !== null) {
    if (sucursalPedida !== undefined) {
      exigirAccesoSucursal(actor, sucursalPedida);
    }

    return actor.sucursalId;
  }

  return SIN_ALCANCE;
}
