// Escritura de libros .xlsx con exceljs en STREAMING.
//
// Decisiones:
//   * Se usa `stream.xlsx.WorkbookWriter` con un `PassThrough`: no se guarda
//     nada en disco y el archivo se genera mientras se envía.
//   * Los importes se escriben como **celdas numéricas** con formato de 2
//     decimales, convirtiendo desde la cadena exacta de la API a céntimos
//     enteros (sin aritmética con floats).
//   * Las fechas y horas se escriben como **texto** "AAAA-MM-DD HH:mm" en
//     America/Lima. exceljs escribe las fechas como números de serie y la
//     hora mostrada depende de la zona del lector; como el requisito es que se
//     vea la hora de America/Lima, se fija como texto (ver la prueba
//     `exports.e2e-spec.ts` que lo demuestra).
//   * Los textos se escriben como cadenas, nunca como fórmulas.
import { PassThrough } from 'node:stream'
import ExcelJS from 'exceljs'
import { textoDeCelda } from './csv'

/** Columna con su ancho razonable (en caracteres de Excel). */
export interface ColumnaExcel {
  header: string
  width?: number
}

/**
 * Importe de la API ("12.50") a número, pasando por céntimos enteros.
 * Devuelve `null` si la cadena no es un decimal válido.
 */
export function aNumeroImporte(texto: string): number | null {
  if (!/^-?\d+(\.\d{1,2})?$/.test(texto)) return null
  const negativo = texto.startsWith('-')
  const [entera, decimal = ''] = texto.replace('-', '').split('.')
  const centimos = Number(entera) * 100 + Number((decimal + '00').slice(0, 2))
  return (negativo ? -centimos : centimos) / 100
}

/**
 * Encabezados cuyos valores son importes o cantidades decimales.
 *
 * Se escriben como número (no como texto) para que Excel pueda sumarlos, y se
 * les fija el formato `0.00`. La lista es explícita para no convertir un código
 * o un teléfono que empiece por dígitos.
 */
const COLUMNAS_NUMERICAS = new Set([
  'Total',
  'Precio',
  'Stock actual',
  'Stock mínimo',
  'Cantidad',
  'Ventas',
  'Tickets',
  'Ticket promedio',
  'Anuladas',
  'Movimientos',
  'Faltas',
  'Faltas justificadas',
  'Insumos con alerta',
  'Entradas abiertas',
]);

/** true si la columna se exporta como número decimal. */
export function esColumnaNumerica(header: string): boolean {
  return COLUMNAS_NUMERICAS.has(header);
}

/** Hora de America/Lima como texto "AAAA-MM-DD HH:mm". */
export function textoFechaHoraLima(iso: string | Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(aFecha(iso))
  // en-CA con hora da "2026-10-17, 14:30"; se cambia la coma por espacio.
  return partes.replace(', ', ' ')
}

/** Día de America/Lima como texto "AAAA-MM-DD". */
export function textoFechaLima(iso: string | Date): string {
  const [fecha] = textoFechaHoraLima(iso).split(' ')
  return fecha ?? ''
}

function aFecha(valor: string | Date): Date {
  return valor instanceof Date ? valor : new Date(valor)
}

export type ValorCelda = string | number | null

/** Una fila de la hoja: valores ya convertidos. */
export type FilaExcel = ValorCelda[]

/**
 * Crea el workbook de streaming y la primera hoja.
 *
 * El llamador añade filas con `sheet.addRow(...).commit()` y al final hace
 * `workbook.commit()`. El `PassThrough` devuelto es legible por la respuesta.
 */
export function crearLibroStreaming(): {
  workbook: ExcelJS.stream.xlsx.WorkbookWriter
  stream: PassThrough
} {
  const stream = new PassThrough()
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream,
    useStyles: true,
    useSharedStrings: false,
  })
  return { workbook, stream }
}

/**
 * Prepara una hoja: encabezado en negrita, fila fija y anchos de columna.
 */
export function prepararHoja(
  sheet: ExcelJS.Worksheet,
  columnas: readonly ColumnaExcel[],
): void {
  const fila = sheet.addRow(columnas.map((c) => c.header))
  fila.font = { bold: true }
  if (typeof (fila as any).commit === 'function') {
    (fila as any).commit()
  }
  try {
    (sheet as any).views = [{ state: 'frozen', ySplit: 1 }]
  } catch {}
  columnas.forEach((columna, indice) => {
    const col = sheet.getColumn(indice + 1)
    col.width = columna.width ?? Math.max(12, columna.header.length + 2)
    if (esColumnaNumerica(columna.header)) {
      col.numFmt = '0.00'
    }
  })
}

/**
 * Convierte una fila de valores de negocio en valores de celda seguros.
 *
 * Si se pasan los encabezados, las columnas numéricas se convierten a número
 * (con la cadena decimal exacta como origen); el resto se queda como texto.
 */
export function filaCelda(
  fila: readonly unknown[],
  columnas?: readonly string[],
): FilaExcel {
  return fila.map((valor, indice) => {
    if (valor === null || valor === undefined) return null
    if (typeof valor === 'number') return valor

    const texto = textoDeCelda(valor)
    if (columnas !== undefined && esColumnaNumerica(columnas[indice] ?? '')) {
      const numero = aNumeroImporte(texto)
      if (numero !== null) return numero
    }
    return texto
  })
}
