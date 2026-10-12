// Detalle de un recuento: quién lo hizo, cuándo, en qué sucursal y, por línea,
// stock de sistema, contado y diferencia. El backend acota el alcance: un
// recuento de otra sucursal responde 404.
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ErrorState } from '@/components/shared/ErrorState'
import { formatearFechaHora } from '@/lib/format/dates'
import { VariacionStock } from './VariacionStock'
import { formatearCantidad } from './presentacion'
import { mensajeDeError } from './mensajes'
import { useRecuentoDetalle } from './queries'

interface RecuentoDetalleDialogProps {
  recuentoId: string
  onClose: () => void
}

export function RecuentoDetalleDialog({
  recuentoId,
  onClose,
}: RecuentoDetalleDialogProps) {
  const { data, isLoading, error, refetch } = useRecuentoDetalle(recuentoId)

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalle del recuento</DialogTitle>
          <DialogDescription>
            Stock de sistema, conteo físico y diferencia por insumo.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <ErrorState
            title="Error al cargar el recuento"
            description={mensajeDeError(error, 'recuento')}
            onRetry={() => void refetch()}
          />
        ) : isLoading || !data ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-64" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Realizado por</dt>
                <dd className="font-medium">{data.usuario.nombre}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Sucursal</dt>
                <dd className="font-medium">{data.sucursal.nombre}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fecha</dt>
                <dd className="font-medium">
                  {formatearFechaHora(data.createdAt)}
                </dd>
              </div>
            </dl>

            {data.detalles.length === 0 ? (
              <Alert>
                <AlertTitle>Sin líneas</AlertTitle>
                <AlertDescription>
                  Este recuento no tiene líneas registradas.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="max-h-80 overflow-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Insumo</TableHead>
                      <TableHead className="text-right">Sistema</TableHead>
                      <TableHead className="text-right">Contado</TableHead>
                      <TableHead className="text-right">Diferencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.detalles.map((linea) => (
                      <TableRow key={linea.id}>
                        <TableCell className="font-medium">
                          {linea.insumoSucursal.insumo.nombre}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatearCantidad(linea.stockSistema)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatearCantidad(linea.stockFisico)}
                        </TableCell>
                        <TableCell className="text-right">
                          <VariacionStock cantidad={linea.diferencia} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
