import { StatusPill } from '@/components/shared/StatusPill'
import { ETIQUETA_ESTADO_USUARIO, TONO_ESTADO_USUARIO } from './presentacion'
import type { EstadoUsuario } from '@/types/api'

/** Estado de un usuario: color + etiqueta según el estado real. */
export function EstadoUsuarioBadge({ estado }: { estado: EstadoUsuario }) {
  return (
    <StatusPill tono={TONO_ESTADO_USUARIO[estado]}>
      {ETIQUETA_ESTADO_USUARIO[estado]}
    </StatusPill>
  )
}