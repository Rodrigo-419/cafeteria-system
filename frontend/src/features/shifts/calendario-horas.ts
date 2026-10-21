// Reglas puras del calendario semanal por horas.
//
// No toca React ni la API: convierte las asignaciones del contrato en bloques
// que la rejilla dibuja. Los días y las horas se calculan en minutos enteros
// para no depender de la coma flotante ni de la zona del navegador.

import type { AsignacionApi } from '@/types/api'

/** Primera y última hora que muestra la rejilla (de 6:00 a 22:00). */
export const HORA_MINIMA = 6
export const HORA_MAXIMA = 22

/** Minutos de una hora "HH:mm" desde medianoche. */
export function minutosDeHora(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h! * 60 + m!
}

/** Hora "HH:mm" a partir de minutos desde medianoche. */
export function horaDeMinutos(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Horas de la rejilla como minutos desde medianoche (una por hora). */
export function horasDeLaRejilla(): number[] {
  const horas: number[] = []
  for (let h = HORA_MINIMA; h <= HORA_MAXIMA; h += 1) {
    horas.push(h * 60)
  }
  return horas
}

/** Un turno fijo visto como bloque de minutos. */
export interface BloqueFijo {
  inicioMin: number
  finMin: number
}

/**
 * Bloque de un turno fijo para un día concreto, o `null` si ese día no toca.
 *
 * Solo se evalúan turnos **fijos**: los variables se muestran como etiqueta del
 * día sin horas. El bloque nace en la hora de inicio y termina en la de fin.
 */
export function bloqueFijoDelDia(
  asignacion: AsignacionApi,
  fechaIso: string,
): BloqueFijo | null {
  const { turno } = asignacion
  if (turno.tipo !== 'fijo') return null

  const inicio = asignacion.fechaInicio.slice(0, 10)
  const fin = asignacion.fechaFin?.slice(0, 10) ?? '9999-12-31'
  if (fechaIso < inicio || fechaIso > fin) return null

  const dias = (turno.diasSemana ?? '')
    .split(',')
    .map((t) => Number(t.trim()))
  const numeroDia = numeroDiaSemana(fechaIso)
  if (!dias.includes(numeroDia)) return null

  if (turno.horaInicio === null || turno.horaFin === null) return null

  return {
    inicioMin: minutosDeHora(turno.horaInicio),
    finMin: minutosDeHora(turno.horaFin),
  }
}

/** `true` si una asignación de turno variable toca un día concreto. */
export function variableTocaElDia(
  asignacion: AsignacionApi,
  fechaIso: string,
): boolean {
  if (asignacion.turno.tipo !== 'variable') return false
  const inicio = asignacion.fechaInicio.slice(0, 10)
  const fin = asignacion.fechaFin?.slice(0, 10) ?? '9999-12-31'
  return fechaIso >= inicio && fechaIso <= fin
}

/**
 * Número ISO del día (1 = lunes ... 7 = domingo) de un "AAAA-MM-DD".
 *
 * Se calcula en UTC para no depender de la zona del navegador.
 */
export function numeroDiaSemana(iso: string): number {
  const [anio, mes, dia] = iso.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio!, mes! - 1, dia!))
  return fecha.getUTCDay() === 0 ? 7 : fecha.getUTCDay()
}

/** `true` si dos bloques se solapan (en minutos). */
export function seSolapan(a: BloqueFijo, b: BloqueFijo): boolean {
  return a.inicioMin < b.finMin && b.inicioMin < a.finMin
}

/** Etiqueta "07:30 – 16:00" de un bloque. */
export function etiquetaBloque(bloque: BloqueFijo): string {
  return `${horaDeMinutos(bloque.inicioMin)} – ${horaDeMinutos(bloque.finMin)}`
}
