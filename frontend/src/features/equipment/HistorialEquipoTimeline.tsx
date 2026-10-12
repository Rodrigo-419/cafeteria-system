// Línea de tiempo del historial de un equipo. Solo hay entradas cuando cambia el
// estado o las observaciones (no al cambiar nombre o tipo). El punto de cada
// entrada toma el color del estado nuevo.
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { cn } from 'cn'
import { formatearFechaHora } from '@/lib/format/dates'
import { EstadoEquipoBadge } from './EstadoEquipoBadge'
import { ETIQUETA_ESTADO_EQUIPO, TONO_ESTADO_EQUIPO } from './presentacion'
import type { HistorialEquipoApi } from '@/types/api'

const COLOR_PUNTO: Record<string, string> = {
  neutral: 'bg-muted-foreground',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-destructive',
  info: 'bg-info',
}

interface HistorialEquipoTimelineProps {
  datos: HistorialEquipoApi[]
  isLoading: boolean
  error: string | null
  onRetry: () => void
}

export function HistorialEquipoTimeline({
  datos,
  isLoading,
  error,
  onRetry,
}: HistorialEquipoTimelineProps) {
  if (error) {
    return (
      <ErrorState
        title="Error al cargar el historial"
        description={error}
        onRetry={onRetry}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (datos.length === 0) {
    return (
      <EmptyState
        title="Sin historial"
        description="Aún no se han registrado cambios de estado u observaciones."
      />
    )
  }

  return (
    <ol className="space-y-0">
      {datos.map((entrada, indice) => {
        const estadoCambia = entrada.estadoAnterior !== entrada.estadoNuevo
        const obsCambia =
          (entrada.observacionesAnterior ?? '') !==
          (entrada.observacionesNuevas ?? '')
        const titulo =
          estadoCambia && obsCambia
            ? 'Estado y observaciones actualizados'
            : estadoCambia
              ? 'Cambio de estado'
              : 'Observaciones actualizadas'
        const ultimo = indice === datos.length - 1

        return (
          <li key={entrada.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                aria-hidden
                className={cn(
                  'mt-1.5 size-2.5 shrink-0 rounded-full',
                  COLOR_PUNTO[TONO_ESTADO_EQUIPO[entrada.estadoNuevo]],
                )}
              />
              {!ultimo && <span className="w-px flex-1 bg-border" />}
            </div>
            <div className="flex-1 space-y-1 pb-5">
              <p className="text-sm font-medium">{titulo}</p>
              <p className="text-xs text-muted-foreground">
                {entrada.usuario?.nombre ?? 'Usuario'} ·{' '}
                {formatearFechaHora(entrada.createdAt)}
              </p>
              {estadoCambia && (
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {ETIQUETA_ESTADO_EQUIPO[entrada.estadoAnterior]}
                  </span>
                  <span aria-hidden className="text-muted-foreground">
                    →
                  </span>
                  <EstadoEquipoBadge estado={entrada.estadoNuevo} />
                </p>
              )}
              {obsCambia && (
                <div className="rounded-lg bg-muted/50 p-2 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">
                    Observaciones
                  </p>
                  <p className="whitespace-pre-wrap">
                    {entrada.observacionesNuevas ?? 'Sin observaciones'}
                  </p>
                  {entrada.observacionesAnterior != null && (
                    <p className="mt-1 text-xs text-muted-foreground line-through">
                      {entrada.observacionesAnterior}
                    </p>
                  )}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
