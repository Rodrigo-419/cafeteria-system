import { Badge } from '@/components/ui/badge'
import type { EstadoVenta } from '@/types/api'
import { ETIQUETA_ESTADO } from './presentacion'

/** Distingue visualmente una venta anulada de una completada. */
export function SaleStatusBadge({ estado }: { estado: EstadoVenta }) {
  return estado === 'anulada' ? (
    <Badge variant="destructive">{ETIQUETA_ESTADO.anulada}</Badge>
  ) : (
    <Badge variant="success">{ETIQUETA_ESTADO.completada}</Badge>
  )
}
