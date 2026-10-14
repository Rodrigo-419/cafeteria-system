// Calendario de negocio del modulo de auditoria.
//
// Reutiliza el calendario canonico de ventas (America/Lima, UTC-5 sin DST) y
// anade el armado del rango [desde, hasta] del listado, con el tope de 92 dias
// que exige la API.
export {
  ZONA_HORARIA_NEGOCIO,
  esFechaLocal,
  instanteDeFechaLocal,
} from '../../sales/domain/rules/fechas';

import {
  esFechaLocal,
  instanteDeFechaLocal,
  rangoDelDiaLocal,
} from '../../sales/domain/rules/fechas';

/** Tope de dias que puede abarcar un rango de fechas. */
export const DIAS_MAXIMOS_RANGO = 92;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Rango UTC para filtrar `created_at`: `gte` inclusivo y `lt` exclusivo.
 *
 * `hasta` es inclusivo a nivel de dia local, por eso el limite superior es el
 * inicio del dia siguiente.
 */
export type RangoAuditoria = { gte?: Date; lt?: Date };

/**
 * Convierte las fechas locales `desde`/`hasta` (inclusive) a un rango UTC.
 *
 * @throws RangeError si alguna fecha no es un dia valido, si `hasta` es
 *   anterior a `desde`, o si el rango supera `DIAS_MAXIMOS_RANGO`.
 */
export function construirRango(
  desde?: string,
  hasta?: string,
): RangoAuditoria {
  if (desde !== undefined && !esFechaLocal(desde)) {
    throw new RangeError('La fecha "desde" no es valida');
  }

  if (hasta !== undefined && !esFechaLocal(hasta)) {
    throw new RangeError('La fecha "hasta" no es valida');
  }

  const rango: RangoAuditoria = {};

  if (desde !== undefined) {
    rango.gte = instanteDeFechaLocal(desde);
  }

  if (hasta !== undefined) {
    rango.lt = rangoDelDiaLocal(hasta).hasta;
  }

  if (rango.gte !== undefined && rango.lt !== undefined) {
    if (rango.lt.getTime() <= rango.gte.getTime()) {
      throw new RangeError('La fecha "hasta" no puede ser anterior a "desde"');
    }

    const dias = (rango.lt.getTime() - rango.gte.getTime()) / MS_POR_DIA;
    if (dias > DIAS_MAXIMOS_RANGO) {
      throw new RangeError(
        `El rango de fechas no puede superar ${DIAS_MAXIMOS_RANGO} dias`,
      );
    }
  }

  return rango;
}
