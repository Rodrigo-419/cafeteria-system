import { StatusPill } from '@/components/shared/StatusPill'
import {
  ETIQUETA_ESTADO_ASIGNACION,
  TONO_ESTADO_ASIGNACION,
  type EstadoAsignacion,
} from './presentacion'

/** Estado de una asignación: color + etiqueta según su vigencia real. */
export function EstadoAsignacionBadge({ estado }: { estado: EstadoAsignacion }) {
  return (
    <StatusPill tono={TONO_ESTADO_ASIGNACION[estado]}>
      {ETIQUETA_ESTADO_ASIGNACION[estado]}
    </StatusPill>
  )
}
