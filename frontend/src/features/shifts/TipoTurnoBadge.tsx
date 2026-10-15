import { StatusPill } from '@/components/shared/StatusPill'
import { ETIQUETA_TIPO_TURNO, TONO_TIPO_TURNO } from './presentacion'
import type { TipoTurno } from '@/types/api'

/** Tipo de un turno: color + etiqueta según el tipo real. */
export function TipoTurnoBadge({ tipo }: { tipo: TipoTurno }) {
  return (
    <StatusPill tono={TONO_TIPO_TURNO[tipo]}>{ETIQUETA_TIPO_TURNO[tipo]}</StatusPill>
  )
}
