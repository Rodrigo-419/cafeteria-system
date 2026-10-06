// Reglas sobre las lineas que forman una venta.
//
// El DTO ya valida cada campo por HTTP, pero estas funciones existen para que
// el caso de uso no dependa de que todo llegue siempre desde un controller: una
// llamada interna, un job o una prueba pueden montar las lineas a mano. Ademas
// son el sitio donde se comprueban las dos propiedades que no ve un
// `ValidateNested`: que no se repita la misma oferta y que el numero de lineas
// sea razonable.

import { METODOS_PAGO_VENTA, esMetodoPagoVenta } from './estados-venta';

/** Numero maximo de lineas distintas que admite una venta. */
export const MAXIMO_LINEAS_VENTA = 100;

/** Cantidad minima y maxima de un producto en una linea. */
export const MINIMO_CANTIDAD = 1;
export const MAXIMO_CANTIDAD = 9999;

/** Una linea tal y como entra en el caso de uso. */
export type LineaVenta = {
  productoSucursalVarianteId: string;
  cantidad: number;
};

/**
 * Lista de problemas de un conjunto de lineas; vacia significa que son validas.
 *
 * @returns mensajes en Castellano, listos para meterlos en un 400.
 */
export function problemasLineas(lineas: readonly LineaVenta[]): string[] {
  if (!Array.isArray(lineas)) {
    return ['items debe ser una lista'];
  }

  if (lineas.length === 0) {
    return ['La venta debe incluir al menos un producto'];
  }

  if (lineas.length > MAXIMO_LINEAS_VENTA) {
    return [`Una venta no puede incluir mas de ${MAXIMO_LINEAS_VENTA} lineas`];
  }

  const problemas: string[] = [];
  const vistas = new Set<string>();

  for (const linea of lineas) {
    if (typeof linea?.productoSucursalVarianteId !== 'string') {
      problemas.push('Cada linea debe indicar una oferta valida');
      continue;
    }

    if (!Number.isSafeInteger(linea.cantidad)) {
      problemas.push('La cantidad debe ser un numero entero');
      continue;
    }

    if (linea.cantidad < MINIMO_CANTIDAD || linea.cantidad > MAXIMO_CANTIDAD) {
      problemas.push(
        `La cantidad debe estar entre ${MINIMO_CANTIDAD} y ${MAXIMO_CANTIDAD}`,
      );
      continue;
    }

    if (vistas.has(linea.productoSucursalVarianteId)) {
      // Dos lineas del mismo producto se sumarian sin motivo: quien quiera dos
      // unidades pone cantidad 2. Aceptar duplicados haria que el descuento o
      // el limite por linea de alguna oferta futura no tuviera sentido.
      problemas.push('Una misma oferta no puede repetirse en la venta');
      continue;
    }

    vistas.add(linea.productoSucursalVarianteId);
  }

  return problemas;
}

/** true si el metodo de pago esta entre los admitidos. */
export function problemaDeMetodoPago(valor: unknown): string[] {
  return esMetodoPagoVenta(valor)
    ? []
    : [`El metodo de pago debe ser uno de: ${METODOS_PAGO_VENTA.join(', ')}`];
}
