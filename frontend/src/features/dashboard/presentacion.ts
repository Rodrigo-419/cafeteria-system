// Etiquetas de presentación del panel de control.
import type { TonoStatusPill } from '@/components/shared/StatusPill'
import type { EstadoEquipo } from '@/types/api'

export const ETIQUETA_ESTADO_EQUIPO: Record<EstadoEquipo, string> = {
  funcionando: 'Funcionando',
  danado: 'Dañado',
  en_mantenimiento: 'En mantenimiento',
  retirado: 'Retirado',
}

export const TONO_ESTADO_EQUIPO: Record<EstadoEquipo, TonoStatusPill> = {
  funcionando: 'success',
  danado: 'error',
  en_mantenimiento: 'warning',
  retirado: 'neutral',
}

/** Orden de presentación de los estados de equipo. */
export const ORDEN_ESTADOS_EQUIPO: readonly EstadoEquipo[] = [
  'funcionando',
  'en_mantenimiento',
  'danado',
  'retirado',
]
