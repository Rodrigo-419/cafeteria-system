import { StatusPill } from '@/components/shared/StatusPill'
import { ETIQUETA_ESTADO_EQUIPO, TONO_ESTADO_EQUIPO } from './presentacion'
import type { EstadoEquipo } from '@/types/api'

/** Estado operativo de un equipo: color + etiqueta según el estado real. */
export function EstadoEquipoBadge({ estado }: { estado: EstadoEquipo }) {
  return (
    <StatusPill tono={TONO_ESTADO_EQUIPO[estado]}>
      {ETIQUETA_ESTADO_EQUIPO[estado]}
    </StatusPill>
  )
}
