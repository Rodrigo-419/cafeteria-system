// Nivel visual de un insumo: píldora de estado más barra proporcional al stock
// respecto del mínimo. La barra se cuantiza a pasos de 5% porque el sistema de
// diseño prohíbe los estilos inline; las clases de ancho existen literalmente
// para que Tailwind las genere.
import { cn } from 'cn'
import { StatusPill, type TonoStatusPill } from '@/components/shared/StatusPill'
import {
  ETIQUETA_NIVEL,
  estadoNivel,
  formatearCantidad,
  porcentajeNivel,
  type EstadoNivel,
} from './presentacion'
import type { EstadoStockInsumo } from '@/types/api'

const TONO: Record<EstadoNivel, TonoStatusPill> = {
  descontinuado: 'neutral',
  bajo: 'error',
  normal: 'success',
}

const BARRA: Record<EstadoNivel, string> = {
  descontinuado: 'bg-muted-foreground',
  bajo: 'bg-destructive',
  normal: 'bg-success',
}

const ANCHOS = [
  'w-px',
  'w-[5%]',
  'w-[10%]',
  'w-[15%]',
  'w-[20%]',
  'w-[25%]',
  'w-[30%]',
  'w-[35%]',
  'w-[40%]',
  'w-[45%]',
  'w-[50%]',
  'w-[55%]',
  'w-[60%]',
  'w-[65%]',
  'w-[70%]',
  'w-[75%]',
  'w-[80%]',
  'w-[85%]',
  'w-[90%]',
  'w-[95%]',
  'w-full',
] as const

interface NivelStockProps {
  stock: string
  minimo: string
  estado: EstadoStockInsumo
}

/** Estado y nivel visual del stock de un insumo en una sucursal. */
export function NivelStock({ stock, minimo, estado }: NivelStockProps) {
  const nivel = estadoNivel(stock, minimo, estado)
  const porcentaje = porcentajeNivel(stock, minimo)
  const indice = Math.max(0, Math.min(20, Math.round(porcentaje / 5)))

  return (
    <div className="flex w-full max-w-xs flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <StatusPill tono={TONO[nivel]}>{ETIQUETA_NIVEL[nivel]}</StatusPill>
        <span className="text-xs font-semibold text-muted-foreground tabular-nums">
          {porcentaje}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            BARRA[nivel],
            ANCHOS[indice],
          )}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatearCantidad(stock)} / mínimo {formatearCantidad(minimo)}
      </span>
    </div>
  )
}
