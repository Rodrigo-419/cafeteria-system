// Regla de dominio: si un insumo puede moverse en una sucursal.
//
// La comprueban tanto una entrada como un recuento, y las dos responden igual,
// asi que vive aqui para que el par 404/409 no se diverga.
//
// La distincion:
//   * 404 - el insumo no esta dado de alta en esa sucursal. No existe la fila
//     `insumo_sucursal`, asi que no hay stock que contar ni que aumentar. La
//     peticion apunta a algo que no esta ahi.
//   * 409 - el insumo esta en esa sucursal pero descontinuado. Existe y tiene
//     historial, pero ya no se repone. Es un conflicto de estado, no un recurso
//     ausente.
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { EstadoStockInsumo } from './estados-insumo';

export const INSUMO_NO_ACTIVADO_EN_SUCURSAL =
  'El insumo no esta dado de alta en esta sucursal';
export const INSUMO_DESCONTINUADO =
  'El insumo esta descontinuado en esta sucursal';

/**
 * Exige que el insumo se pueda mover en esa sucursal.
 *
 * `estado` llega como `undefined` cuando no hay fila `insumo_sucursal`: el
 * parametro acepta ese caso para que quien llame pueda delegar el 404 en vez de
 * tener que lanzar la excepcion a mano.
 *
 * @throws NotFoundException (404) si no hay fila.
 * @throws ConflictException (409) si esta descontinuado.
 */
export function exigirInsumoOperativo(estado: EstadoStockInsumo | undefined): void {
  if (estado === undefined) {
    throw new NotFoundException(INSUMO_NO_ACTIVADO_EN_SUCURSAL);
  }

  if (estado === 'descontinuado') {
    throw new ConflictException(INSUMO_DESCONTINUADO);
  }
}
