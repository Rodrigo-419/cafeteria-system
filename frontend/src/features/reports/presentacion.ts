// Presentación del reporte comparativo.
//
// Estas funciones solo ordenan y resumen lo que devuelve el backend: validan el
// rango con las mismas reglas (días de calendario, tope de 92) y suman importes
// en centimos enteros. Nunca inventan cifras ni calculan métricas que el
// backend no entregue.
import { aCentimos } from '@/lib/format/money'
import { esFechaLocalValida } from '@/lib/format/dates'
import type { ReporteSucursalApi } from '@/types/api'

/** Tope de días de calendario que acepta el backend (inclusive). */
export const MAXIMO_DIAS_RANGO = 92

const MILISEGUNDOS_DIA = 86_400_000

/** Número de días de calendario del rango `[desde, hasta]`, ambos incluidos. */
export function diasDelRango(desde: string, hasta: string): number {
  const inicio = Date.parse(`${desde}T00:00:00.000Z`)
  const fin = Date.parse(`${hasta}T00:00:00.000Z`)
  return Math.round((fin - inicio) / MILISEGUNDOS_DIA) + 1
}

/** Día `AAAA-MM-DD` que queda `dias` antes de `dia` (aritmética en UTC). */
export function restarDias(dia: string, dias: number): string {
  const fecha = new Date(`${dia}T00:00:00.000Z`)
  fecha.setUTCDate(fecha.getUTCDate() - dias)
  return fecha.toISOString().slice(0, 10)
}

/**
 * Valida el rango antes de llamar al backend y devuelve el mensaje de error o
 * `null` si es correcto. Replica las reglas del backend: fechas obligatorias y
 * reales, `hasta >= desde` y como máximo 92 días.
 */
export function validarRango(desde: string, hasta: string): string | null {
  if (desde === '' || hasta === '') {
    return 'Selecciona la fecha de inicio y de fin.'
  }
  if (!esFechaLocalValida(desde) || !esFechaLocalValida(hasta)) {
    return 'Ingresa fechas válidas en formato AAAA-MM-DD.'
  }
  if (hasta < desde) {
    return 'La fecha "hasta" no puede ser anterior a "desde".'
  }
  if (diasDelRango(desde, hasta) > MAXIMO_DIAS_RANGO) {
    return `El rango no puede superar ${MAXIMO_DIAS_RANGO} días.`
  }
  return null
}

/** Centimos de un importe en texto; 0 si el texto no tiene el formato esperado. */
export function centimosDeImporte(texto: string): number {
  try {
    return aCentimos(texto)
  } catch {
    return 0
  }
}

/**
 * Ticket promedio de la red con aritmética entera y redondeo half-up (al
 * centimo más cercano). Devuelve `null` cuando no hubo ventas, para mostrar
 * "—" en lugar de un `0.00` que fingiría una media real.
 */
export function ticketPromedioRed(
  totalCentimos: number,
  cantidad: number,
): number | null {
  if (cantidad <= 0) {
    return null
  }
  return Math.floor((2 * totalCentimos + cantidad) / (2 * cantidad))
}

export interface TotalesRed {
  ventasCentimos: number
  tickets: number
  ticketPromedioCentimos: number | null
  alertasAbiertas: number
  movimientos: number
  faltas: number
}

/** Resume en KPI las filas del reporte, sumando solo lo que el backend envía. */
export function totalesDeRed(filas: readonly ReporteSucursalApi[]): TotalesRed {
  let ventasCentimos = 0
  let tickets = 0
  let alertasAbiertas = 0
  let movimientos = 0
  let faltas = 0

  for (const fila of filas) {
    ventasCentimos += centimosDeImporte(fila.ventas.total)
    tickets += fila.ventas.cantidad
    alertasAbiertas += fila.estadoActual.insumosConAlertaAbierta
    movimientos += fila.inventario.movimientos.total
    faltas += fila.asistencia.faltas
  }

  return {
    ventasCentimos,
    tickets,
    ticketPromedioCentimos: ticketPromedioRed(ventasCentimos, tickets),
    alertasAbiertas,
    movimientos,
    faltas,
  }
}
