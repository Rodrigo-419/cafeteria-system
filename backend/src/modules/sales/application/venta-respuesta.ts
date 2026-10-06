// Forma en la que una venta sale por la API.
//
// La fila del repositorio trae todo menos los dos campos calculados: el total
// (que se suma de `venta_detalle`, porque `venta` no lo guarda) y el dia local
// en el que cayo la venta. Aqui se montan, para que el mismo mapeo no se
// repita en registrar, anular, listar y obtener.

import {
  aCentimos,
  centimosATexto,
  sumarCentimos,
} from '../domain/rules/dinero';
import { fechaLocalDe } from '../domain/rules/fechas';
import type {
  DetalleVentaFila,
  TotalesVenta,
  VentaFila,
} from '../infrastructure/sales.repository';

/** Venta con su total, su numero de lineas y su dia local. */
export type VentaRespuesta = VentaFila & {
  /** Dia local (`YYYY-MM-DD`) en el que se creo la venta. */
  fecha: string;
  /** Suma de los subtotales, con exactamente dos decimales. */
  total: string;
  /** Numero de lineas de la venta. */
  lineas: number;
};

/** Venta con sus totales y sus lineas ya montadas. */
export type VentaCompletaRespuesta = VentaRespuesta & {
  detalles: DetalleVentaFila[];
};

/**
 * Total y numero de lineas a partir de los subtotales de las lineas.
 *
 * Se suma en centimos exactos: sumar los `"0.10"` de la base con coma flotante
 * dejaria totales con error de redondeo en cuanto hubiera unas cuantas lineas.
 *
 * @throws Error si algun subtotal guardado no es un importe valido. Es un dato
 * corrupto, no un error de entrada: no hay respuesta correcta que devolver.
 */
export function totalesDeLineas(
  detalles: readonly { subtotal: string }[],
): TotalesVenta {
  const centimos: number[] = [];

  for (const detalle of detalles) {
    const subtotal = aCentimos(detalle.subtotal);

    if (subtotal === null) {
      throw new Error(`Subtotal no valido: ${detalle.subtotal}`);
    }

    centimos.push(subtotal);
  }

  const total = sumarCentimos(centimos);

  if (total === null) {
    throw new Error('El total de la venta supera el maximo permitido');
  }

  return { total: centimosATexto(total), lineas: detalles.length };
}

/** Da a una fila sus importes calculados y su dia local. */
export function aRespuestaVenta(
  venta: VentaFila,
  totales: TotalesVenta,
): VentaRespuesta {
  return {
    ...venta,
    fecha: fechaLocalDe(venta.createdAt),
    total: totales.total,
    lineas: totales.lineas,
  };
}

/** Idem, con las lineas de la venta. */
export function aRespuestaVentaCompleta(
  venta: VentaFila,
  totales: TotalesVenta,
  detalles: DetalleVentaFila[],
): VentaCompletaRespuesta {
  return {
    ...aRespuestaVenta(venta, totales),
    detalles,
  };
}
