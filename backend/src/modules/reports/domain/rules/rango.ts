// Regla de dominio: el rango de dias del reporte comparativo.
//
// El rango es inclusivo por los dos extremos y no puede superar 92 dias. La
// comprobacion es pura: recibe dos dias locales `YYYY-MM-DD` y no toca ni el
// reloj ni la base.
import { diaUtc } from '../../../employees/domain/fechas';

const MILISEGUNDOS_DIA = 86_400_000;

/** Tope de dias que puede abarcar un reporte comparativo (inclusive). */
export const MAXIMO_DIAS_RANGO_COMPARATIVO = 92;

/** Numero de dias de calendario del rango `[desde, hasta]`, ambos incluidos. */
export function diasDelRango(desde: string, hasta: string): number {
  return (
    (diaUtc(hasta).getTime() - diaUtc(desde).getTime()) / MILISEGUNDOS_DIA + 1
  );
}
