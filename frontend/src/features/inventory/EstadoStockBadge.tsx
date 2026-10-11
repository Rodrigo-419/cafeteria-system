import { StatusPill } from '@/components/shared/StatusPill'
import { ETIQUETA_ESTADO_STOCK } from './presentacion'
import type { EstadoStockInsumo } from '@/types/api'

/** Estado de un insumo en la sucursal: activo (verde) o descontinuado (neutro). */
export function EstadoStockBadge({ estado }: { estado: EstadoStockInsumo }) {
  return (
    <StatusPill tono={estado === 'activo' ? 'success' : 'neutral'}>
      {ETIQUETA_ESTADO_STOCK[estado]}
    </StatusPill>
  )
}
