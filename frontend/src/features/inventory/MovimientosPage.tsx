// Historial de movimientos de stock de una sucursal (solo lectura).
//
// La `cantidad` de un movimiento es la VARIACIÓN (puede ser negativa): entrada
// suma, ajuste puede subir o bajar. El backend no embebe el insumo ni el
// usuario, así que el nombre del insumo se resuelve cruzando `insumoSucursalId`
// con el stock de la sucursal; el usuario solo está como id.
import { useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusPill, type TonoStatusPill } from '@/components/shared/StatusPill'
import { useAuth } from '@/lib/auth/useAuth'
import { formatearFechaHora } from '@/lib/format/dates'
import { VariacionStock } from './VariacionStock'
import { mensajeDeError } from './mensajes'
import { LIMITE_RESUMEN, useMovimientos, useStock, useSucursales } from './queries'
import type { MovimientoInventarioApi, TipoMovimientoInventario } from '@/types/api'

const PAGE_SIZE = 20

const ETIQUETA_TIPO: Record<TipoMovimientoInventario, string> = {
  entrada: 'Entrada',
  ajuste: 'Ajuste',
}

const TONO_TIPO: Record<TipoMovimientoInventario, TonoStatusPill> = {
  entrada: 'success',
  ajuste: 'info',
}

export function MovimientosPage() {
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'Admin'

  const [sucursalAdmin, setSucursalAdmin] = useState('')
  const [insumoId, setInsumoId] = useState('todos')
  const [tipo, setTipo] = useState<TipoMovimientoInventario | 'todos'>('todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [page, setPage] = useState(1)

  const sucursalId = esAdmin
    ? sucursalAdmin || null
    : (usuario?.sucursalId ?? null)
  const sucursales = useSucursales(esAdmin)

  const stock = useStock(sucursalId, { page: 1, limit: LIMITE_RESUMEN })

  const filtros = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(insumoId !== 'todos' ? { insumoId } : {}),
      ...(tipo !== 'todos' ? { tipo } : {}),
      ...(desde !== '' ? { desde } : {}),
      ...(hasta !== '' ? { hasta } : {}),
    }),
    [page, insumoId, tipo, desde, hasta],
  )

  const movimientos = useMovimientos(sucursalId, filtros)

  const { nombrePorInsumoSucursal, opcionesInsumo } = useMemo(() => {
    const nombres = new Map<string, string>()
    const opciones = new Map<string, string>()
    for (const fila of stock.data?.data ?? []) {
      nombres.set(fila.id, fila.insumo.nombre)
      opciones.set(fila.insumoId, fila.insumo.nombre)
    }
    return {
      nombrePorInsumoSucursal: nombres,
      opcionesInsumo: [...opciones.entries()]
        .map(([id, nombre]) => ({ id, nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    }
  }, [stock.data])

  function reiniciar(accion: () => void) {
    accion()
    setPage(1)
  }

  const columnas: Column<MovimientoInventarioApi>[] = [
    {
      key: 'createdAt',
      header: 'Fecha',
      cell: (fila) => formatearFechaHora(fila.createdAt),
    },
    {
      key: 'insumo',
      header: 'Insumo',
      cell: (fila) =>
        nombrePorInsumoSucursal.get(fila.insumoSucursalId) ?? '—',
    },
    {
      key: 'tipo',
      header: 'Tipo',
      cell: (fila) => (
        <StatusPill tono={TONO_TIPO[fila.tipo]}>
          {ETIQUETA_TIPO[fila.tipo]}
        </StatusPill>
      ),
    },
    {
      key: 'cantidad',
      header: 'Variación',
      className: 'text-right',
      cell: (fila) => (
        <div className="flex justify-end">
          <VariacionStock cantidad={fila.cantidad} />
        </div>
      ),
    },
    {
      key: 'motivo',
      header: 'Motivo',
      cell: (fila) => fila.motivo,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movimientos"
        description="Entradas y ajustes de stock de la sucursal"
      />

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-5">
          {esAdmin && (
            <div className="space-y-2">
              <Label htmlFor="movimientos-sucursal">Sucursal</Label>
              <Select
                value={sucursalAdmin}
                onValueChange={(valor) =>
                  reiniciar(() => setSucursalAdmin(valor))
                }
              >
                <SelectTrigger id="movimientos-sucursal">
                  <SelectValue placeholder="Selecciona una sucursal" />
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

          <div className="space-y-2">
            <Label htmlFor="movimientos-insumo">Insumo</Label>
            <Select
              value={insumoId}
              onValueChange={(valor) => reiniciar(() => setInsumoId(valor))}
            >
              <SelectTrigger id="movimientos-insumo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {opcionesInsumo.map((opcion) => (
                  <SelectItem key={opcion.id} value={opcion.id}>
                    {opcion.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="movimientos-tipo">Tipo</Label>
            <Select
              value={tipo}
              onValueChange={(valor) =>
                reiniciar(() =>
                  setTipo(valor as TipoMovimientoInventario | 'todos'),
                )
              }
            >
              <SelectTrigger id="movimientos-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="entrada">{ETIQUETA_TIPO.entrada}</SelectItem>
                <SelectItem value="ajuste">{ETIQUETA_TIPO.ajuste}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="movimientos-desde">Desde</Label>
            <Input
              id="movimientos-desde"
              type="date"
              value={desde}
              onChange={(evento) =>
                reiniciar(() => setDesde(evento.target.value))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="movimientos-hasta">Hasta</Label>
            <Input
              id="movimientos-hasta"
              type="date"
              value={hasta}
              onChange={(evento) =>
                reiniciar(() => setHasta(evento.target.value))
              }
            />
          </div>
        </CardContent>
      </Card>

      {sucursalId === null ? (
        <EmptyState
          title="Selecciona una sucursal"
          description="Elige la sucursal cuyos movimientos quieres consultar."
        />
      ) : (
        <DataTable
          columns={columnas}
          data={movimientos.data?.data ?? []}
          isLoading={movimientos.isLoading}
          error={
            movimientos.error
              ? mensajeDeError(movimientos.error, 'movimiento')
              : null
          }
          onRetry={() => void movimientos.refetch()}
          page={page}
          pageSize={PAGE_SIZE}
          total={movimientos.data?.total}
          onPageChange={setPage}
          getRowId={(fila) => fila.id}
          emptyTitle="Sin movimientos"
          emptyDescription="No hay entradas ni ajustes que coincidan con los filtros."
        />
      )}
    </div>
  )
}
