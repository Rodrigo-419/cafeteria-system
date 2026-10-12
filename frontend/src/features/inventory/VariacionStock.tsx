// Variación de stock con signo y color, más una etiqueta textual.
//
// La cantidad de un movimiento es la VARIACIÓN (puede ser negativa), no el
// saldo. El signo ya aporta una pista no cromática; además se muestra la palabra
// ("Aumento"/"Disminución"/"Sin cambio") para no depender solo del color.
import { cn } from 'cn'
import {
  ETIQUETA_VARIACION,
  formatearVariacion,
  signoVariacion,
  type SignoVariacion,
} from './presentacion'

const TONO_TEXTO: Record<SignoVariacion, string> = {
  aumento: 'text-success',
  disminucion: 'text-destructive',
  'sin-cambio': 'text-muted-foreground',
}

interface VariacionStockProps {
  /** Variación decimal como texto ("-1.50", "10.00", "0.00"). */
  cantidad: string
  /** Muestra la etiqueta textual junto al valor (por defecto sí). */
  conEtiqueta?: boolean
  className?: string
}

export function VariacionStock({
  cantidad,
  conEtiqueta = true,
  className,
}: VariacionStockProps) {
  const signo = signoVariacion(cantidad)
  return (
    <span
      className={cn('inline-flex items-center gap-2 tabular-nums', className)}
    >
      <span className={cn('font-semibold', TONO_TEXTO[signo])}>
        {formatearVariacion(cantidad)}
      </span>
      {conEtiqueta && (
        <span className="text-xs font-medium text-muted-foreground">
          {ETIQUETA_VARIACION[signo]}
        </span>
      )}
    </span>
  )
}
