import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusIcon } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { MoneyText } from '@/components/shared/MoneyText'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import { formatearFechaHora } from '@/lib/format/dates'
import { precioEnCentimos, ETIQUETA_METODO } from './presentacion'
import { SaleStatusBadge } from './SaleStatusBadge'
import { AnnulSaleDialog } from './AnnulSaleDialog'
import { mensajeDeError } from './mensajes'
import { useSucursales, useVentas } from './queries'
import { BotonExportar } from '@/features/exports/BotonExportar'
import type { EstadoVenta, MetodoPagoVenta, VentaApi } from '@/types/api'

const PAGE_SIZE = 20

type FiltroEstado = EstadoVenta | 'todas'
type FiltroMetodo = MetodoPagoVenta | 'todos'

export function SalesListPage() {
  const { usuario, permisos } = useAuth()
  const esAdmin = usuario?.rol === 'Admin'
  const puedeRegistrar = tienePermiso(permisos, 'ventas.registrar')
  const puedeAnular = tienePermiso(permisos, 'ventas.anular')

  const [page, setPage] = useState(1)
  const [estado, setEstado] = useState<FiltroEstado>('todas')
  const [metodoPago, setMetodoPago] = useState<FiltroMetodo>('todos')
  const [fecha, setFecha] = useState('')
  const [sucursalId, setSucursalId] = useState('todas')

  const sucursales = useSucursales(esAdmin)

  const filtros = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(estado !== 'todas' ? { estado } : {}),
      ...(metodoPago !== 'todos' ? { metodoPago } : {}),
      ...(fecha !== '' ? { fecha } : {}),
      ...(esAdmin && sucursalId !== 'todas' ? { sucursalId } : {}),
    }),
    [page, estado, metodoPago, fecha, sucursalId, esAdmin],
  )

  const { data, isLoading, error, refetch } = useVentas(filtros)

  function reiniciarPagina() {
    setPage(1)
  }

  const columnas: Column<VentaApi>[] = [
    {
      key: 'fecha',
      header: 'Fecha y hora',
      cell: (venta) => formatearFechaHora(venta.createdAt),
    },
    {
      key: 'vendedor',
      header: 'Registró',
      cell: (venta) => venta.vendedor.nombre,
    },
    {
      key: 'lineas',
      header: 'Líneas',
      cell: (venta) => venta.lineas,
    },
    {
      key: 'metodoPago',
      header: 'Pago',
      cell: (venta) => ETIQUETA_METODO[venta.metodoPago],
    },
    {
      key: 'total',
      header: 'Total',
      cell: (venta) => (
        <MoneyText amountCents={precioEnCentimos(venta.total) ?? 0} />
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      cell: (venta) => <SaleStatusBadge estado={venta.estado} />,
    },
    {
      key: 'acciones',
      header: '',
      className: 'text-right',
      cell: (venta) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/sales/${venta.id}`}>Ver</Link>
          </Button>
          {venta.estado === 'completada' && puedeAnular && (
            <AnnulSaleDialog venta={venta} />
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ventas"
        description="Historial de ventas y anulaciones"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BotonExportar conjunto="ventas" desde={fecha} hasta={fecha} />
            {puedeRegistrar && (
              <Button asChild>
                <Link to="/sales/nueva">
                  <PlusIcon className="size-4" />
                  Nueva venta
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="filtro-estado">Estado</Label>
            <Select
              value={estado}
              onValueChange={(valor) => {
                setEstado(valor as FiltroEstado)
                reiniciarPagina()
              }}
            >
              <SelectTrigger id="filtro-estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="completada">Completadas</SelectItem>
                <SelectItem value="anulada">Anuladas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filtro-metodo">Método de pago</Label>
            <Select
              value={metodoPago}
              onValueChange={(valor) => {
                setMetodoPago(valor as FiltroMetodo)
                reiniciarPagina()
              }}
            >
              <SelectTrigger id="filtro-metodo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filtro-fecha">Fecha</Label>
            <Input
              id="filtro-fecha"
              type="date"
              value={fecha}
              onChange={(evento) => {
                setFecha(evento.target.value)
                reiniciarPagina()
              }}
            />
          </div>

          {esAdmin && (
            <div className="space-y-2">
              <Label htmlFor="filtro-sucursal">Sucursal</Label>
              <Select
                value={sucursalId}
                onValueChange={(valor) => {
                  setSucursalId(valor)
                  reiniciarPagina()
                }}
              >
                <SelectTrigger id="filtro-sucursal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {(sucursales.data ?? []).map((sucursal) => (
                    <SelectItem key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <DataTable
        columns={columnas}
        data={data?.data ?? []}
        isLoading={isLoading}
        error={error ? mensajeDeError(error, 'listar') : null}
        onRetry={() => void refetch()}
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.total}
        onPageChange={setPage}
        getRowId={(venta) => venta.id}
        emptyTitle="Sin ventas"
        emptyDescription="No hay ventas que coincidan con los filtros."
      />
    </div>
  )
}
