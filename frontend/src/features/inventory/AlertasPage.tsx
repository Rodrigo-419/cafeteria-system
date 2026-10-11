// Pantalla de alertas de stock (solo lectura).
//
// Las alertas se abren al bajar del mínimo y se cierran al reponer stock o al
// descontinuar el insumo: las gestiona el backend. Aunque el permiso se llame
// `alertas.ver_resolver`, no existe ruta para resolverlas a mano.
import { useMemo, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusPill } from '@/components/shared/StatusPill'
import { useAuth } from '@/lib/auth/useAuth'
import { formatearFechaHora } from '@/lib/format/dates'
import { ETIQUETA_PRESENTACION, formatearCantidad } from './presentacion'
import { mensajeDeError } from './mensajes'
import { useAlertas, useSucursales } from './queries'
import type { AlertaStockApi, EstadoAlertaStock } from '@/types/api'

const PAGE_SIZE = 20

type FiltroEstado = EstadoAlertaStock | 'todas'

export function AlertasPage() {
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'Admin'

  const [estado, setEstado] = useState<FiltroEstado>('abierta')
  const [sucursalAdmin, setSucursalAdmin] = useState('')
  const [page, setPage] = useState(1)

  const sucursales = useSucursales(esAdmin)

  const filtros = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(estado !== 'todas' ? { estado } : {}),
      ...(esAdmin && sucursalAdmin !== '' ? { sucursalId: sucursalAdmin } : {}),
    }),
    [page, estado, esAdmin, sucursalAdmin],
  )

  const { data, isLoading, error, refetch } = useAlertas(filtros)

  const nombreSucursal = useMemo(() => {
    const mapa = new Map(
      (sucursales.data ?? []).map((sucursal) => [sucursal.id, sucursal.nombre]),
    )
    return (id: string) => mapa.get(id) ?? id
  }, [sucursales.data])

  const columnas: Column<AlertaStockApi>[] = [
    {
      key: 'insumo',
      header: 'Insumo',
      cell: (alerta) => (
        <span className="font-medium">{alerta.insumoSucursal.insumo.nombre}</span>
      ),
    },
    {
      key: 'presentacion',
      header: 'Presentación',
      cell: (alerta) =>
        ETIQUETA_PRESENTACION[
          alerta.insumoSucursal.insumo
            .presentacion as keyof typeof ETIQUETA_PRESENTACION
        ] ?? alerta.insumoSucursal.insumo.presentacion,
    },
    ...(esAdmin
      ? [
          {
            key: 'sucursal',
            header: 'Sucursal',
            cell: (alerta: AlertaStockApi) =>
              nombreSucursal(alerta.insumoSucursal.sucursalId),
          } satisfies Column<AlertaStockApi>,
        ]
      : []),
    {
      key: 'stockActual',
      header: 'Stock actual',
      className: 'text-right tabular-nums',
      cell: (alerta) => formatearCantidad(alerta.insumoSucursal.stockActual),
    },
    {
      key: 'stockMinimo',
      header: 'Stock mínimo',
      className: 'text-right tabular-nums',
      cell: (alerta) => formatearCantidad(alerta.insumoSucursal.stockMinimo),
    },
    {
      key: 'estado',
      header: 'Estado',
      cell: (alerta) => (
        <StatusPill tono={alerta.estado === 'abierta' ? 'warning' : 'success'}>
          {alerta.estado === 'abierta' ? 'Abierta' : 'Resuelta'}
        </StatusPill>
      ),
    },
    {
      key: 'createdAt',
      header: 'Abierta',
      cell: (alerta) => (
        <span className="text-muted-foreground">
          {formatearFechaHora(alerta.createdAt)}
        </span>
      ),
    },
    {
      key: 'fechaResuelta',
      header: 'Resuelta',
      cell: (alerta) => (
        <span className="text-muted-foreground">
          {alerta.fechaResuelta ? formatearFechaHora(alerta.fechaResuelta) : '—'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alertas de stock"
        description="Insumos en o por debajo del mínimo de su sucursal"
      />

      <Alert>
        <AlertTitle>Alertas automáticas</AlertTitle>
        <AlertDescription>
          Se abren al bajar del mínimo y se cierran al reponer el stock. No se
          resuelven manualmente.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="alertas-estado">Estado</Label>
            <Select
              value={estado}
              onValueChange={(valor) => {
                setEstado(valor as FiltroEstado)
                setPage(1)
              }}
            >
              <SelectTrigger id="alertas-estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="abierta">Abiertas</SelectItem>
                <SelectItem value="resuelta">Resueltas</SelectItem>
                <SelectItem value="todas">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {esAdmin && (
            <div className="space-y-2">
              <Label htmlFor="alertas-sucursal">Sucursal</Label>
              <Select
                value={sucursalAdmin}
                onValueChange={(valor) => {
                  setSucursalAdmin(valor)
                  setPage(1)
                }}
              >
                <SelectTrigger id="alertas-sucursal">
                  <SelectValue placeholder="Todas las sucursales" />
                </SelectTrigger>
                <SelectContent>
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
        error={error ? mensajeDeError(error, 'alertas') : null}
        onRetry={() => void refetch()}
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.total}
        onPageChange={setPage}
        getRowId={(alerta) => alerta.id}
        emptyTitle="Sin alertas"
        emptyDescription="No hay alertas para el filtro seleccionado."
      />
    </div>
  )
}
