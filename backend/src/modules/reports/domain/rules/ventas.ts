// Regla de dominio: agregados de ventas del reporte.
//
// Los importes viajan siempre en centimos enteros y solo se convierten a texto
// con dos decimales al formar la respuesta. El ticket promedio se calcula con
// aritmetica entera y redondeo half-up (al centimo mas cercano, y al alza en el
// empate) para no depender de la coma flotante.

/**
 * Convierte centimos enteros a texto con dos decimales.
 *
 * A diferencia de `centimosATexto` del modulo de ventas, no impone el tope de
 * una columna `Decimal(10,2)`: un total de 92 dias de una sucursal puede superar
 * lo que cabe en una sola fila y sigue siendo un importe legitimo del reporte.
 *
 * @throws RangeError si `centimos` no es un entero seguro.
 */
export function formatearCentimos(centimos: number): string {
  if (!Number.isSafeInteger(centimos)) {
    throw new RangeError(`Los centimos deben ser un entero: ${centimos}`);
  }

  const signo = centimos < 0 ? '-' : '';
  const absoluto = Math.abs(centimos);

  return `${signo}${Math.floor(absoluto / 100)}.${(absoluto % 100)
    .toString()
    .padStart(2, '0')}`;
}

/**
 * Centimos enteros de un importe en texto con hasta dos decimales.
 *
 * Lo usan los agregados `SUM(...)::numeric(p,2)::text`, que pueden superar el
 * tope de una columna `Decimal(10,2)` y por eso no pasan por `aCentimos`. Si el
 * texto no tiene el formato esperado devuelve 0: el `cast` de la consulta
 * garantiza el formato, asi que un valor raro solo puede venir de un error de
 * programacion que conviene no propagar como un numero silencioso.
 */
export function centimosDeTexto(texto: string): number {
  const coincidencia = /^(-?)(\d+)(?:\.(\d{1,2}))?$/u.exec(texto.trim());
  if (!coincidencia) {
    return 0;
  }

  const signo = coincidencia[1] === '-' ? -1 : 1;
  const enteros = Number(coincidencia[2]);
  const decimales = (coincidencia[3] ?? '').padEnd(2, '0');

  if (!Number.isSafeInteger(enteros)) {
    return 0;
  }

  const centimos = signo * (enteros * 100 + Number(decimales));

  return Number.isSafeInteger(centimos) ? centimos : 0;
}

/**
 * Ticket promedio, en texto con dos decimales, de un total y un numero de
 * ventas.
 *
 * Devuelve `null` cuando no hubo ventas: no hay un promedio que mostrar y un
 * `0.00` fingiria una media real.
 */
export function ticketPromedio(
  totalCentimos: number,
  cantidad: number,
): string | null {
  if (!Number.isSafeInteger(totalCentimos) || cantidad <= 0) {
    return null;
  }

  // Half-up con enteros: (2·total + cantidad) / (2·cantidad), truncando.
  const promedio = Math.floor(
    (2 * totalCentimos + cantidad) / (2 * cantidad),
  );

  return formatearCentimos(promedio);
}
