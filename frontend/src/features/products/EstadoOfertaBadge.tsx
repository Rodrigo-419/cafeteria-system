import { StatusPill } from '@/components/shared/StatusPill'
import { ETIQUETA_OFERTA } from './presentacion'
import type { EstadoOferta } from '@/types/api'

/** Estado de una oferta de sucursal: activo (verde) o inactivo (neutro). */
export function EstadoOfertaBadge({ estado }: { estado: EstadoOferta }) {
  return (
    <StatusPill tono={estado === 'activo' ? 'success' : 'neutral'}>
      {ETIQUETA_OFERTA[estado]}
    </StatusPill>
  )
}
