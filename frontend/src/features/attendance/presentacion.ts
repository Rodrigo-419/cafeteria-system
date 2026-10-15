// Presentación (etiquetas y tonos) del módulo de asistencia.
//
// Se centralizan aquí los textos y colores que comparten las pantallas de
// marcación, registros y faltas para no repetirlos en cada componente.
import type { TonoStatusPill } from '@/components/shared/StatusPill'
import type { TipoMarcaje, TurnoDeFaltaApi } from '@/types/api'

/** Tipos de marcaje admitidos, en el orden en que se ofrecen. */
export const TIPOS_MARCAJE: readonly TipoMarcaje[] = ['entrada', 'salida']

/** Etiqueta legible de cada tipo de marcaje. */
export const ETIQUETA_TIPO_MARCAJE: Record<string, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
}

/** Tono de la píldora de estado según el tipo de marcaje. */
export const TONO_TIPO_MARCAJE: Record<string, TonoStatusPill> = {
  entrada: 'success',
  salida: 'info',
}

/** Etiqueta legible de un tipo de marcaje desconocido. */
export function etiquetaTipo(tipo: string): string {
  return ETIQUETA_TIPO_MARCAJE[tipo] ?? tipo
}

/** Tono de la píldora de un tipo de marcaje desconocido. */
export function tonoTipo(tipo: string): TonoStatusPill {
  return TONO_TIPO_MARCAJE[tipo] ?? 'neutral'
}

/** Etiqueta legible del método de marcaje ("pin" → "PIN"). */
export function etiquetaMetodo(metodo: string): string {
  if (metodo === 'pin') return 'PIN'
  if (metodo === 'manual') return 'Manual'
  return metodo
}

/** Días de la semana en el orden ISO 1..7 (lunes a domingo). */
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Describe el turno asociado a una falta ("Turno fijo · Lun, Mar, ..."). */
export function etiquetaTurnoFalta(turno: TurnoDeFaltaApi): string {
  const base = turno.tipo === 'fijo' ? 'Turno fijo' : 'Turno flexible'
  if (!turno.diasSemana) return base
  const dias = turno.diasSemana
    .split(',')
    .map((dia) => DIAS_SEMANA[Number(dia) - 1] ?? dia)
    .join(', ')
  return `${base} · ${dias}`
}
