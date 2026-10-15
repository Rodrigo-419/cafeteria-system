// Diálogo con el historial de correcciones de un registro (G2).
//
// Carga el detalle (`GET /attendance/records/:id`) que añade las correcciones al
// registro efectivo. Es la vista de solo lectura; corregir se delega al diálogo
// `CorregirRegistroDialog` cuando el usuario tiene el permiso.
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/ErrorState'
import { StatusPill } from '@/components/shared/StatusPill'
import { formatearFechaHora } from '@/lib/format/dates'
import { mensajeDeError } from '@/features/attendance/mensajes'
import {
  etiquetaMetodo,
  etiquetaTipo,
  tonoTipo,
} from '@/features/attendance/presentacion'
import { useRegistroAsistencia } from '@/features/attendance/queries'
import type { RegistroAsistenciaApi } from '@/types/api'

interface RegistroDetalleDialogProps {
  id: string
  puedeCorregir: boolean
  onCerrar: () => void
  onCorregir: (registro: RegistroAsistenciaApi) => void
}

export function RegistroDetalleDialog({
  id,
  puedeCorregir,
  onCerrar,
  onCorregir,
}: RegistroDetalleDialogProps) {
  const detalle = useRegistroAsistencia(id)

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Historial del registro</DialogTitle>
          <DialogDescription>
            Marcación efectiva y sus correcciones registradas.
          </DialogDescription>
        </DialogHeader>

        {detalle.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : detalle.error ? (
          <ErrorState
            title="No se pudo cargar el registro"
            description={mensajeDeError(detalle.error, 'detalle')}
            onRetry={() => void detalle.refetch()}
          />
        ) : detalle.data ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Colaborador</dt>
                <dd className="font-medium">{detalle.data.empleado.nombre}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tipo</dt>
                <dd>
                  <StatusPill tono={tonoTipo(detalle.data.tipo)}>
                    {etiquetaTipo(detalle.data.tipo)}
                  </StatusPill>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fecha y hora</dt>
                <dd className="tabular-nums">
                  {formatearFechaHora(detalle.data.fechaHora)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Método</dt>
                <dd>{etiquetaMetodo(detalle.data.metodo)}</dd>
              </div>
            </dl>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Correcciones</h3>
              {detalle.data.correcciones.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este registro no tiene correcciones.
                </p>
              ) : (
                <ul className="space-y-2">
                  {detalle.data.correcciones.map((correccion) => (
                    <li
                      key={correccion.id}
                      className="rounded-lg border p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <StatusPill tono={tonoTipo(correccion.tipo)}>
                          {etiquetaTipo(correccion.tipo)}
                        </StatusPill>
                        <span className="tabular-nums text-muted-foreground">
                          {formatearFechaHora(correccion.fechaHora)}
                        </span>
                      </div>
                      {correccion.motivo && (
                        <p className="mt-1 text-muted-foreground">
                          {correccion.motivo}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
          {puedeCorregir && detalle.data && (
            <Button onClick={() => onCorregir(detalle.data)}>Corregir</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
