// Regla de dominio: cantidades de inventario.
//
// `stock_actual`, `stock_minimo`, `cantidad`, `stock_fisico` y `diferencia` son
// columnas `Decimal(12,2)`. Aquí viven las tres piezas que el resto del módulo
// necesita:
//
//   1. Validación de lo que llega por HTTP (número finito, no negativo o
//      positivo según el caso, como mucho dos decimales y dentro del rango de
//      la columna).
//   2. Comparación de cantidades. `stock_actual <= stock_minimo` no puede
//      hacerse con `<` sobre `number`: la base devuelve `Decimal`, y comparar
//      un decimal binario contra otro puede dar un resultado distinto al que
//      esperaba quien escribió la regla. Todo se pasa a céntimos enteros.
//   3. Serialización a texto con exactamente dos decimales, que es la forma en
//      que la API expone los importes y la que se envía a la columna.
//
// No importa nada de Nest ni de Prisma: son funciones puras y las pruebas las
// ejercitan sin base de datos.

/** La columna es `Decimal(12,2)`: diez cifras enteras y dos decimales. */
export const CANTIDAD_MAXIMA = 9999999999.99;

export const CANTIDAD_DECIMALES = 2;

/**
 * Factor para pasar a céntimos. `Decimal(12,2)` llega a 9999999999.99, que en
 * céntimos son 999999999999: muy por debajo de `Number.MAX_SAFE_INTEGER`
 * (9007199254740991), así que la suma de céntimos es exacta.
 */
const FACTOR_CENTIMOS = 100;

export type OpcionesCantidad = {
  /** Si es true el valor debe ser MAYOR que cero; si es false, mayor o igual. */
  positivoEstricto: boolean;
};

/**
 * Los dos criterios de aceptacion que usa el modulo, con nombre.
 *
 *   * `noNegativa` - stock minimo, stock fisico contado: cero es un valor legitimo
 *     ("no hay nada de esto en la estanteria").
 *   * `positiva` - cantidad de una entrada o de un ajuste: mover cero unidades no
 *     es una entrada, es una peticion vacia.
 */
export const tipoProblemasCantidad = {
  noNegativa: { positivoEstricto: false },
  positiva: { positivoEstricto: true },
} as const satisfies Record<string, OpcionesCantidad>;

/**
 * Representación decimal en texto.
 *
 * No se usa `toString().split('.')[1].length` a propósito: para un número en
 * notación exponencial ese `[1]` es `undefined` y revienta con un TypeError.
 * Dentro del rango de la columna la forma exponencial no aparece, así que
 * medir sobre `toString()` es seguro aquí.
 */
export function tieneMasDeDosDecimales(valor: number): boolean {
  const texto = valor.toString();
  const punto = texto.indexOf('.');

  if (punto === -1) {
    return false;
  }

  return texto.length - punto - 1 > CANTIDAD_DECIMALES;
}

/**
 * Lista de problemas de una cantidad; vacía significa que es válida.
 *
 * @returns mensajes en castellano, listos para un 400.
 */
export function problemasCantidad(
  valor: unknown,
  opciones: OpcionesCantidad,
): string[] {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return ['La cantidad debe ser un numero'];
  }

  const problemas: string[] = [];
  const referenciaMinima = opciones.positivoEstricto ? 'mayor que 0' : 'mayor o igual a 0';

  if (opciones.positivoEstricto ? valor <= 0 : valor < 0) {
    problemas.push(`La cantidad debe ser ${referenciaMinima}`);
  }

  if (valor > CANTIDAD_MAXIMA) {
    problemas.push(`La cantidad no puede exceder ${CANTIDAD_MAXIMA}`);
  }

  if (tieneMasDeDosDecimales(valor)) {
    problemas.push(
      `La cantidad no puede tener mas de ${CANTIDAD_DECIMALES} decimales`,
    );
  }

  return problemas;
}

/** true si la cantidad cumple la regla. */
export function esCantidadValida(
  valor: unknown,
  opciones: OpcionesCantidad,
): valor is number {
  return problemasCantidad(valor, opciones).length === 0;
}

/**
 * Pasa una cantidad a céntimos enteros, que es la forma exacta de comparar.
 *
 * Acepta las tres formas en que llega una cantidad al modulo:
 *   * el `number` que llega por HTTP,
 *   * el texto con dos decimales que se manda a la base o se devuelve al cliente,
 *   * el `Decimal` de Prisma que se lee de ella.
 *
 * `Number.NaN` si no es un decimal valido o si trae mas de dos decimales: quien
 * llama decide que hacer con ese caso.
 */
export function aCentimos(valor: DecimalConvertible | number | string): number {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? Math.round(valor * FACTOR_CENTIMOS) : Number.NaN;
  }

  const normalizado =
    typeof valor === 'string' ? valor.trim() : decimalATexto(valor);

  if (!/^-?\d+(\.\d+)?$/u.test(normalizado)) {
    return Number.NaN;
  }

  const [entero, decimales = ''] = normalizado.split('.') as [string, string?];

  if (decimales.length > CANTIDAD_DECIMALES) {
    return Number.NaN;
  }

  const centimos = Number(decimales.padEnd(CANTIDAD_DECIMALES, '0'));
  const signo = entero.startsWith('-') ? -1 : 1;
  const magnitud = Number(entero.replace('-', ''));

  return signo * (magnitud * FACTOR_CENTIMOS + centimos);
}

/** Cantidad en cualquiera de las tres formas en que llega al modulo. */
export type Cantidad = DecimalConvertible | number | string;

/** true si dos cantidades son iguales, con la precisión de la columna. */
export function mismaCantidad(a: Cantidad, b: Cantidad): boolean {
  return aCentimos(a) === aCentimos(b);
}

/** Compara dos cantidades con la precisión de la columna. */
export function compararCantidades(a: Cantidad, b: Cantidad): -1 | 0 | 1 {
  const ca = aCentimos(a);
  const cb = aCentimos(b);

  if (ca < cb) {
    return -1;
  }
  return ca > cb ? 1 : 0;
}

/** Convierte céntimos al texto con exactamente dos decimales. */
export function centimosATexto(centimos: number): string {
  const signo = centimos < 0 ? '-' : '';
  const magnitud = Math.abs(centimos);
  const entero = Math.trunc(magnitud / FACTOR_CENTIMOS);
  const resto = magnitud % FACTOR_CENTIMOS;

  return `${signo}${entero}.${String(resto).padStart(CANTIDAD_DECIMALES, '0')}`;
}

/**
 * Convierte una cantidad ya validada al texto exacto que espera la columna
 * `Decimal(12,2)`.
 *
 * Se serializa a texto en vez de dejar que Prisma convierta el `number`: así el
 * valor que llega a la base no arrastra el error de representación binaria de un
 * decimal.
 */
export function cantidadATexto(valor: number): string {
  return valor.toFixed(CANTIDAD_DECIMALES);
}

/**
 * Un `Decimal` tal y como lo tipa Prisma. Se declara por estructura, y no
 * importando el tipo de Prisma, para que estas reglas sigan siendo puras.
 */
export type DecimalConvertible = {
  toFixed(decimales: number): string;
};

/**
 * Pasa a texto con dos decimales un valor que viene de la base.
 *
 * El stock de una columna `Decimal(12,2)` llega como `Decimal` de Prisma, y su
 * `toString()` depende de la escala con la que se construyó. `toFixed(2)` es la
 * forma de fijar la escala sin depender de eso.
 */
export function decimalATexto(valor: DecimalConvertible): string {
  return valor.toFixed(CANTIDAD_DECIMALES);
}

/**
 * Diferencia entre el stock contado y el que tenia el sistema: fisico - sistema.
 *
 * Positiva cuando el sistema se habia quedado corto, negativa cuando sobra. Se
 * devuelve como texto con dos decimales porque es lo que va a
 * `recuento_inventario_detalle.diferencia` y a `movimiento_inventario.cantidad`.
 *
 * @throws si alguna cantidad no es un decimal válido. Es un error de
 * programación, no de la petición: el DTO y las reglas ya han validado ambas
 * antes de llegar aquí.
 */
export function calcularDiferencia(stockFisico: Cantidad, stockSistema: Cantidad): string {
  const fisico = aCentimos(stockFisico);
  const sistema = aCentimos(stockSistema);

  if (Number.isNaN(fisico) || Number.isNaN(sistema)) {
    throw new Error(
      'calcularDiferencia recibio una cantidad que no es un decimal valido',
    );
  }

  return centimosATexto(fisico - sistema);
}

/** true si la diferencia es cero: no hay ajuste que registrar. */
export function diferenciaEsCero(diferencia: string): boolean {
  return aCentimos(diferencia) === 0;
}
