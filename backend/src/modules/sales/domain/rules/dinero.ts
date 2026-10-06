// Importes de una venta: todo en centimos enteros.
//
// El dinero nunca pasa por un `number` con coma flotante. Un precio de 0.10 y
// una cantidad de 3 suman 0.30000000000000004 en coma flotante, y esa basura
// acabaria en la columna `subtotal` de `venta_detalle`. Aqui los precios llegan
// desde la base como texto con dos decimales, se convierten a centimos
// enteros (suma y producto exactos) y solo se vuelven a texto al guardar o al
// responder.

/** Decimales que admiten las columnas `Decimal(10,2)` del modulo. */
export const DECIMALES_IMPORTE = 2;

/**
 * Centimos que caben en un `Decimal(10,2)`: 8 enteros mas 2 decimales.
 *
 * `99_999_999_99` centimos = 99.999.999,99, el mayor valor representable.
 */
export const MAXIMO_CENTIMOS = 9_999_999_999;

/** Minimo valor que puede tener un importe: cero. */
export const MINIMO_CENTIMOS = 0;

/**
 * Convierte un importe en texto o numero a centimos enteros exactos.
 *
 * Acepta `"12.5"`, `"12.50"`, `"12"` y un `number` entero. Rechaza cualquier
 * cosa que no represente un decimal exacto con como mucho dos decimales, y
 * tambien lo que se salga del rango de la columna.
 *
 * @returns centimos exactos, o `null` si el valor no es representable.
 */
export function aCentimos(valor: unknown): number | null {
  let texto: string;

  if (typeof valor === 'number') {
    if (!Number.isFinite(valor) || !Number.isInteger(valor)) {
      // Un number con decimales se rechaza en vez de redondear: un precio
      // redondeado en silencio es un precio que nadie pidio.
      return null;
    }
    texto = valor.toString();
  } else if (typeof valor === 'string') {
    texto = valor.trim();
  } else {
    return null;
  }

  const coincidencia = /^(-?)(\d+)(?:\.(\d{1,2}))?$/u.exec(texto);
  if (!coincidencia) {
    return null;
  }

  const signo = coincidencia[1] === '-' ? -1 : 1;
  const enteros = Number(coincidencia[2]);
  const decimales = (coincidencia[3] ?? '').padEnd(DECIMALES_IMPORTE, '0');

  if (!Number.isSafeInteger(enteros)) {
    return null;
  }

  const centimos = signo * (enteros * 100 + Number(decimales));

  if (centimos < MINIMO_CENTIMOS || centimos > MAXIMO_CENTIMOS) {
    return null;
  }

  return centimos;
}

/**
 * Convierte centimos exactos al texto que espera una columna `Decimal(10,2)`.
 *
 * Se fija la escala en la frontera de la base a proposito: el `Decimal` de
 * Prisma se serializa con la escala con la que se construyo, asi que un
 * `"8"` y un `"8.00"` saldrian distintos para el mismo importe.
 *
 * @throws RangeError si `centimos` no es un entero dentro del rango.
 */
export function centimosATexto(centimos: number): string {
  if (!Number.isSafeInteger(centimos)) {
    throw new RangeError(`Los centimos deben ser un entero: ${centimos}`);
  }

  if (centimos < MINIMO_CENTIMOS || centimos > MAXIMO_CENTIMOS) {
    throw new RangeError(`Importe fuera de rango: ${centimos}`);
  }

  const signo = centimos < 0 ? '-' : '';
  const absoluto = Math.abs(centimos);

  return `${signo}${Math.floor(absoluto / 100)}.${
    (absoluto % 100).toString().padStart(DECIMALES_IMPORTE, '0')
  }`;
}

/**
 * Subtotal de una linea: precio por cantidad, en centimos exactos.
 *
 * @returns el subtotal, o `null` si el resultado no cabe en un `Decimal(10,2)`.
 */
export function subtotalLinea(
  precioCentimos: number,
  cantidad: number,
): number | null {
  if (!Number.isSafeInteger(precioCentimos) || !Number.isSafeInteger(cantidad)) {
    return null;
  }

  const subtotal = precioCentimos * cantidad;

  if (subtotal < MINIMO_CENTIMOS || subtotal > MAXIMO_CENTIMOS) {
    return null;
  }

  return subtotal;
}

/**
 * Suma de importes ya validados.
 *
 * Los sumandos salen todos de `aCentimos` o `subtotalLinea`, asi que o son
 * `null` o estan dentro de rango: la suma no puede desbordar el tipo entero
 * seguro antes de comprobar despues el maximo de la columna.
 */
export function sumarCentimos(centimos: readonly number[]): number | null {
  let total = 0;

  for (const valor of centimos) {
    if (!Number.isSafeInteger(valor)) {
      return null;
    }

    total += valor;

    if (total > MAXIMO_CENTIMOS) {
      return null;
    }
  }

  return total;
}
