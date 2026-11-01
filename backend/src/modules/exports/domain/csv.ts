// Escritor CSV con las reglas pedidas:
//   * UTF-8 con BOM (para que Excel abra bien los acentos);
//   * CRLF como separador de línea;
//   * comillas escapadas;
//   * protección contra inyección de fórmulas (prefijo con comilla simple en
//     valores que empiecen por =, +, -, @, tabulador o retorno de carro).
//
// Es puro: recibe las filas y devuelve el texto. No toca el sistema de
// archivos ni la red.

const BOM = '\uFEFF';
const CRLF = '\r\n';

/** Caracteres que abren una fórmula en Excel/Calc y hay que neutralizar. */
const INICIO_DE_FORMULA = ['=', '+', '-', '@', '\t', '\r'];

/** Protege un valor contra la inyección de fórmulas. */
export function protegerFormula(valor: string): string {
  if (INICIO_DE_FORMULA.includes(valor[0] ?? '')) {
    return `'${valor}`;
  }
  return valor;
}

/** Alias para compatibilidad */
export const protectsFormulaInjection = protegerFormula;

/** Cita un campo si contiene separador, comillas o saltos de línea. */
export function campo(valor: string): string {
  const protegido = protegerFormula(valor);
  if (
    protegido.includes(',') ||
    protegido.includes('"') ||
    protegido.includes('\n') ||
    protegido.includes('\r')
  ) {
    return `"${protegido.replace(/"/g, '""')}"`;
  }
  return protegido;
}

/** Convierte un valor de celda en texto (nunca `undefined` ni `null`). */
export function textoDeCelda(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) {
    // Instante en America/Lima, como texto legible.
    return valor.toISOString();
  }
  return String(valor);
}

/**
 * Construye el CSV completo (BOM + filas unidas con CRLF).
 *
 * `encabezados` son los nombres de columna en español; `filas` son arreglos de
 * valores en el mismo orden.
 */
export function construirCsv(
  encabezados: readonly string[],
  filas: readonly unknown[][],
): string {
  const lineas = [encabezados.map(campo).join(',')];
  for (const fila of filas) {
    lineas.push(fila.map((v) => campo(textoDeCelda(v))).join(','));
  }
  return BOM + lineas.join(CRLF) + CRLF;
}
