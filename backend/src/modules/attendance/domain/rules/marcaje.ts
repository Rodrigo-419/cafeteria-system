// Regla de dominio: conflicto de una marcacion nueva.
//
// "Doble marcaje" no es solo repetir tipo: la regla depende del dia local y de
// si hay una entrada efectiva abierta HOY. Una entrada de un dia anterior que
// quedo sin cerrar no bloquea una entrada nueva; se queda abierta y se puede
// cerrar aparte. Una salida, en cambio, necesita una entrada abierta del MISMO
// dia. La regla es pura: recibe el dia local ya calculado y las entradas
// abiertas con el suyo.
import { REGISTRO_ENTRADA, REGISTRO_SALIDA } from './registros-efectivos';

/** Entrada efectiva abierta, reducida a su dia local. */
export type EntradaAbiertaDia = {
  diaLocal: string;
};

/**
 * Motivo por el que una marcacion no se puede registrar, o null si es valida.
 *
 * @param tipo `entrada` o `salida`.
 * @param diaLocalAhora dia local del negocio en el momento de marcar.
 * @param entradasAbiertas entradas efectivas que siguen sin salida.
 */
export function problemaMarcaje(
  tipo: string,
  diaLocalAhora: string,
  entradasAbiertas: readonly EntradaAbiertaDia[],
): string | null {
  const hayAbiertaHoy = entradasAbiertas.some(
    (entrada) => entrada.diaLocal === diaLocalAhora,
  );

  if (tipo === REGISTRO_ENTRADA) {
    return hayAbiertaHoy ? 'Ya hay una entrada abierta de hoy' : null;
  }

  if (tipo === REGISTRO_SALIDA) {
    return hayAbiertaHoy ? null : 'No hay una entrada abierta de hoy para cerrar';
  }

  return 'Tipo de marcaje no valido';
}
