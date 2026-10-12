// Historial de recuentos físicos (solo lectura) con acceso al detalle.
//
// El listado solo trae la cabecera (id, sucursalId, usuarioId, createdAt): el
// nombre del usuario y de la sucursal llegan en el detalle, que se abre por
// línea. El Admin ve todas las sucursales y puede filtrar; el Gerente, las
// suyas (el backend acota el alcance).
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import { formatearFechaHora } from '@/lib/format/dates'
import { RecuentoDetalleDialog } from './RecuentoDetalleDialog'
import { mensajeDeError } from './mensajes'
import { useRecuentos, useSucursales } from './queries'
import type { RecuentoApi } from '@/types/api'

const PAGE_SIZE = 20

function idCorto(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

export function RecuentosPage() {
  const navegar = useNavigate()
  const { usuario, permisos } = useAuth()
  const esAdmin = usuario?.rol === 'Admin'
  const puedeRecuento = tienePermiso(permisos, 'inventario.recuento')

  const [sucursalAdmin, setSucursalAdmin] = useState('todas')
  const [page, setPage] = useState(1)
  const [detalleId, setDetalleId] = useState<string | null>(null)

  const sucursales = useSucursales(true)

  const filtros = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(esAdmin && sucursalAdmin !== 'todas'
        ? { sucursalId: sucursalAdmin }
        : {}),
    }),
    [page, esAdmin, sucursalAdmin],
  )

  const recuentos = useRecuentos(filtros)

  const nombresSucursal = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const sucursal of sucursales.data ?? []) {
      mapa.set(sucursal.id, sucursal.nombre)
    }
    return mapa
  }, [sucursales.data])

  const columnas: Column<RecuentoApi>[] = [
    {
      key: 'createdAt',
      header: 'Fecha',
      cell: (fila) => formatearFechaHora(fila.createdAt),
    },
    ...(esAdmin
      ? [
          {
            key: 'sucursal',
            header: 'Sucursal',
            cell: (fila: RecuentoApi) =>
              nombresSucursal.get(fila.sucursalId) ?? idCorto(fila.sucursalId),
          } satisfies Column<RecuentoApi>,
        ]
      : []),
    {
      key: 'usuario',
      header: 'Usuario',
      cell: (fila) => (
        <span title={fila.usuarioId}>{idCorto(fila.usuarioId)}</span>
      ),
    },
    ...(puedeRecuento
      ? [
          {
            key: 'acciones',
            header: '',
            className: 'text-right',
            cell: (fila: RecuentoApi) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDetalleId(fila.id)}
              >
                Ver detalle
              </Button>
            ),
          } satisfies Column<RecuentoApi>,
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recuentos"
        description="Historial de conteos físicos y sus ajustes de stock"
        actions={
          puedeRecuento ? (
            <Button onClick={() => navegar('/inventory/recuentos/nuevo')}>
              <PlusIcon className="size-4" />
              Nuevo recuento
            </Button>
          ) : undefined
        }
      />

      {esAdmin && (
        <Card>
          <CardContent className="pt-6">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="recuentos-sucursal">Sucursal</Label>
              <Select
                value={sucursalAdmin}
                onValueChange={(valor) => {
                  setSucursalAdmin(valor)
                  setPage(1)
                }}
              >
                <SelectTrigger id="recuentos-sucursal">
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
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={columnas}
        data={recuentos.data?.data ?? []}
        isLoading={recuentos.isLoading}
        error={recuentos.error ? mensajeDeError(recuentos.error, 'recuento') : null}
        onRetry={() => void recuentos.refetch()}
        page={page}
        pageSize={PAGE_SIZE}
        total={recuentos.data?.total}
        onPageChange={setPage}
        getRowId={(fila) => fila.id}
        emptyTitle="Sin recuentos"
        emptyDescription="Aún no se ha registrado ningún conteo físico en el alcance actual."
      />

      {detalleId !== null && (
        <RecuentoDetalleDialog
          recuentoId={detalleId}
          onClose={() => setDetalleId(null)}
        />
      )}
    </div>
  )
}
