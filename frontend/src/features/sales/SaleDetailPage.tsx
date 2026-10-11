import { Link, useParams } from 'react-router-dom'
import { ArrowLeftIcon, BanIcon } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { MoneyText } from '@/components/shared/MoneyText'
import { ErrorState } from '@/components/shared/ErrorState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import { formatearFechaHora } from '@/lib/format/dates'
import { AnnulSaleDialog } from './AnnulSaleDialog'
import { SaleStatusBadge } from './SaleStatusBadge'
import { mensajeDeError } from './mensajes'
import { ETIQUETA_METODO, precioEnCentimos } from './presentacion'
import { useVenta } from './queries'

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { permisos } = useAuth()
  const puedeAnular = tienePermiso(permisos, 'ventas.anular')

  const { data: venta, isLoading, error, refetch } = useVenta(id)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (error || !venta) {
    return (
      <div className="space-y-6">
        <PageHeader title="Detalle de venta" />
        <ErrorState
          title="No se pudo cargar la venta"
          description={
            error
              ? mensajeDeError(error, 'listar')
              : 'La venta no existe o está fuera de tu alcance.'
          }
          onRetry={() => void refetch()}
        />
        <Button variant="ghost" asChild>
          <Link to="/sales">
            <ArrowLeftIcon className="size-4" />
            Volver al listado
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Detalle de venta"
        description={`Folio ${venta.id} · ${formatearFechaHora(venta.createdAt)}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/sales">
                <ArrowLeftIcon className="size-4" />
                Volver
              </Link>
            </Button>
            {venta.estado === 'completada' && puedeAnular && (
              <AnnulSaleDialog venta={venta} />
            )}
          </>
        }
      />

      {venta.estado === 'anulada' && (
        <Alert variant="destructive">
          <BanIcon className="size-4" />
          <AlertTitle>Venta anulada</AlertTitle>
          <AlertDescription>
            {venta.anulador?.nombre ?? '—'}
            {venta.fechaAnulacion
              ? ` · ${formatearFechaHora(venta.fechaAnulacion)}`
              : ''}
            {venta.motivoAnulacion ? ` · ${venta.motivoAnulacion}` : ''}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SaleStatusBadge estado={venta.estado} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Sucursal
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{venta.sucursal.nombre}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Registró
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{venta.vendedor.nombre}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Método de pago
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {ETIQUETA_METODO[venta.metodoPago]}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Líneas ({venta.lineas})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Variante</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio unitario</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {venta.detalles.map((detalle) => (
                <TableRow key={detalle.id}>
                  <TableCell>{detalle.producto.nombre}</TableCell>
                  <TableCell>{detalle.variante.nombre}</TableCell>
                  <TableCell className="text-right">
                    {detalle.cantidad}
                  </TableCell>
                  <TableCell className="text-right">
                    <MoneyText
                      amountCents={precioEnCentimos(detalle.precioUnitario) ?? 0}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <MoneyText
                      amountCents={precioEnCentimos(detalle.subtotal) ?? 0}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-end gap-2 border-t pt-4 text-base font-semibold">
            <span>Total</span>
            <MoneyText amountCents={precioEnCentimos(venta.total) ?? 0} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
