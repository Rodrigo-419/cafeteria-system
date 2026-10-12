// Etiquetas y reglas de presentación del módulo de equipos.
//
// Las validaciones replican (sin sustituir) las del backend: el servidor es la
// autoridad y responde 400/409 con su propio mensaje. Los estados y sus colores
// son los mismos que muestra el backend en el contrato (nombres en snake_case).
import type { TonoStatusPill } from '@/components/shared/StatusPill'
import type { EstadoEquipo } from '@/types/api'

/** Estados posibles en el orden operativo del ciclo de vida. */
export const ESTADOS_EQUIPO: readonly EstadoEquipo[] = [
  'funcionando',
  'danado',
  'en_mantenimiento',
  'retirado',
]

export const ETIQUETA_ESTADO_EQUIPO: Record<EstadoEquipo, string> = {
  funcionando: 'Funcionando',
  danado: 'Dañado',
  en_mantenimiento: 'En mantenimiento',
  retirado: 'Retirado',
}

/** Color semántico de cada estado (independiente de la marca). */
export const TONO_ESTADO_EQUIPO: Record<EstadoEquipo, TonoStatusPill> = {
  funcionando: 'success',
  danado: 'error',
  en_mantenimiento: 'warning',
  retirado: 'neutral',
}

export const LARGO_NOMBRE_EQUIPO = { min: 2, max: 100 } as const
export const LARGO_TIPO_EQUIPO = { min: 2, max: 50 } as const
export const LARGO_OBSERVACIONES_EQUIPO = 500

/** `retirado` es terminal: no admite más cambios de estado. */
export function esEstadoTerminal(estado: EstadoEquipo): boolean {
  return estado === 'retirado'
}

/** Estados válidos como destino desde `estadoActual` (excluye el actual). */
export function estadosDisponibles(estadoActual: EstadoEquipo): EstadoEquipo[] {
  if (esEstadoTerminal(estadoActual)) return []
  return ESTADOS_EQUIPO.filter((estado) => estado !== estadoActual)
}

/** Mensaje de error de un campo de texto, o `null` si es válido. */
export function mensajeTexto(
  valor: string,
  campo: string,
  limites: { min: number; max: number },
): string | null {
  const limpio = valor.trim()
  if (limpio.length < limites.min) {
    return `${campo} debe tener al menos ${limites.min} caracteres.`
  }
  if (limpio.length > limites.max) {
    return `${campo} no puede exceder ${limites.max} caracteres.`
  }
  return null
}
