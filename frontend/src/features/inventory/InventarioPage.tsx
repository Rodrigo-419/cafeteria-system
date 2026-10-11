// Pantalla de inventario por sucursal: stock actual y mínimo de cada insumo,
// nivel visual, alta de insumos en la sucursal y registro de entradas.
//
// - Admin: elige la sucursal que quiere mirar.
// - Gerente: su propia sucursal (el backend 404 fuera de alcance).
// - Editar el mínimo y dar de alta requiere `inventario.minimo.editar`;
//   registrar entradas requiere `inventario.registrar`.
import { useEffect, useMemo, useState } from 'react'
import {
  CircleCheckIcon,
  PackageIcon,
  PackagePlusIcon,
  PencilIcon,
  PlusIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { cn } from 'cn'
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
import { DataTable, type Column } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import { ConfigurarStockDialog } from './ConfigurarStockDialog'
import { EntradaDialog } from './EntradaDialog'
import { EstadoStockBadge } from './EstadoStockBadge'
import { NivelStock } from './NivelStock'
import {
  ETIQUETA_ESTADO_STOCK,
  ETIQUETA_PRESENTACION,
  estadoNivel,
  formatearCantidad,
} from './presentacion'
import { mensajeDeError } from './mensajes'
import { useResumenStock, useStock, useSucursales } from './queries'
import type { EstadoStockInsumo, StockInsumoApi } from '@/types/api'

const PAGE_SIZE = 20

type DialogoStock = StockInsumoApi | null | 'nuevo'

export function InventarioPage() {
  const { usuario, permisos } = useAuth()
  const esAdmin = usuario?.rol === 'Admin'
  const puedeRegistrar = tienePermiso(permisos, 'inventario.registrar')
  const puedeConfigurar = tienePermiso(permisos, 'inventario.minimo.editar')

  const [sucursalAdmin, setSucursalAdmin] = useState('')
  const [page, setPage] = useState(1)
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState<EstadoStockInsumo | 'todos'>('todos')
  const [soloBajoMinimo, setSoloBajoMinimo] = useState(false)
  const [entrada, setEntrada] = useState<DialogoStock>(null)
  const [config, setConfig] = useState<DialogoStock>(null)

  useEffect(() => {
    const temporizador = setTimeout(() => {
      setQ(texto)
      setPage(1)
    }, 300)
    return () => clearTimeout(temporizador)
  }, [texto])

  const sucursalId = esAdmin
    ? sucursalAdmin || null
    : (usuario?.sucursalId ?? null)
  const sucursales = useSucursales(esAdmin)

  const filtros = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(q.trim() !== '' ? { q: q.trim() } : {}),
      ...(estado !== 'todos' ? { estado } : {}),
      ...(soloBajoMinimo ? { soloBajoMinimo: true } : {}),
    }),
    [page, q, estado, soloBajoMinimo],
  )

  const stock = useStock(sucursalId, filtros)
  const resumen = useResumenStock(sucursalId)
  const normales =
    resumen.total != null && resumen.bajoMinimo != null
      ? resumen.total - resumen.bajoMinimo
      : null

  const columnas: Column<StockInsumoApi>[] = [
    {
      key: 'insumo',
      header: 'Insumo',
      cell: (fila) => <span className="font-medium">{fila.insumo.nombre}</span>,
    },
    {
      key: 'presentacion',
      header: 'Presentación',
      cell: (fila) => ETIQUETA_PRESENTACION[fila.insumo.presentacion],
    },
    {
      key: 'stockActual',
      header: 'Stock actual',
      className: 'text-right tabular-nums',
      cell: (fila) => (
        <span
          className={cn(
            'font-semibold',
            estadoNivel(fila.stockActual, fila.stockMinimo, fila.estado) === 'bajo' &&
              'text-destructive',
          )}
        >
          {formatearCantidad(fila.stockActual)}
        </span>
      ),
    },
    {
      key: 'stockMinimo',
      header: 'Stock mínimo',
      className: 'text-right tabular-nums',
      cell: (fila) => formatearCantidad(fila.stockMinimo),
    },
    {
      key: 'estado',
      header: 'Estado',
      cell: (fila) => <EstadoStockBadge estado={fila.estado} />,
    },
    {
      key: 'nivel',
      header: 'Nivel',
      cell: (fila) => (
        <NivelStock
          stock={fila.stockActual}
          minimo={fila.stockMinimo}
          estado={fila.estado}
        />
      ),
    },
    ...(puedeRegistrar || puedeConfigurar
      ? [
          {
            key: 'acciones',
            header: '',
            className: 'text-right',
            cell: (fila: StockInsumoApi) => (
              <div className="flex justify-end gap-1">
                {puedeRegistrar && fila.estado === 'activo' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEntrada(fila)}
                  >
                    <PackagePlusIcon className="size-4" />
                    Registrar entrada
                  </Button>
                )}
                {puedeConfigurar && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfig(fila)}
                  >
                    <PencilIcon className="size-4" />
                    Configurar
                  </Button>
                )}
              </div>
            ),
          } satisfies Column<StockInsumoApi>,
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario"
        description="Stock, mínimos y entradas por sucursal"
        actions={
          sucursalId ? (
            <div className="flex flex-wrap gap-2">
              {puedeConfigurar && (
                <Button variant="outline" onClick={() => setConfig('nuevo')}>
                  <PlusIcon className="size-4" />
                  Añadir insumo
                </Button>
              )}
              {puedeRegistrar && (
                <Button onClick={() => setEntrada('nuevo')}>
                  <PackagePlusIcon className="size-4" />
                  Registrar entrada
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      {sucursalId && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Total registrado"
            icon={PackageIcon}
            value={resumen.total ?? '—'}
            hint="Insumos dados de alta en la sucursal"
          />
          <StatCard
            title="Normal"
            icon={CircleCheckIcon}
            value={normales ?? '—'}
            hint="Insumos por encima del mínimo"
          />
          <StatCard
            title="Bajo mínimo"
            icon={TriangleAlertIcon}
            tone="warning"
            value={resumen.bajoMinimo ?? '—'}
            hint="Requieren reposición"
          />
        </div>
      )}

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          {esAdmin && (
            <div className="space-y-2">
              <Label htmlFor="inventario-sucursal">Sucursal</Label>
              <Select
                value={sucursalAdmin}
                onValueChange={(valor) => {
                  setSucursalAdmin(valor)
                  setPage(1)
                }}
              >
                <SelectTrigger id="inventario-sucursal">
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
            <Label htmlFor="inventario-busqueda">Buscar</Label>
            <Input
              id="inventario-busqueda"
              value={texto}
              placeholder="Nombre del insumo…"
              onChange={(evento) => setTexto(evento.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inventario-estado">Estado</Label>
            <Select
              value={estado}
              onValueChange={(valor) => {
                setEstado(valor as EstadoStockInsumo | 'todos')
                setPage(1)
              }}
            >
              <SelectTrigger id="inventario-estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="activo">
                  {ETIQUETA_ESTADO_STOCK.activo}
                </SelectItem>
                <SelectItem value="descontinuado">
                  {ETIQUETA_ESTADO_STOCK.descontinuado}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              variant={soloBajoMinimo ? 'destructive' : 'outline'}
              className="w-full"
              onClick={() => {
                setSoloBajoMinimo((valor) => !valor)
                setPage(1)
              }}
            >
              <TriangleAlertIcon className="size-4" />
              Solo bajo mínimo
              {resumen.bajoMinimo != null ? ` (${resumen.bajoMinimo})` : ''}
            </Button>
          </div>
        </CardContent>
      </Card>

      {sucursalId === null ? (
        <EmptyState
          title="Selecciona una sucursal"
          description="Elige una sucursal para consultar y gestionar su inventario."
        />
      ) : (
        <DataTable
          columns={columnas}
          data={stock.data?.data ?? []}
          isLoading={stock.isLoading}
          error={stock.error ? mensajeDeError(stock.error, 'stock') : null}
          onRetry={() => void stock.refetch()}
          page={page}
          pageSize={PAGE_SIZE}
          total={stock.data?.total}
          onPageChange={setPage}
          getRowId={(fila) => fila.id}
          emptyTitle="Sin insumos en la sucursal"
          emptyDescription="Añade insumos del catálogo para empezar a llevar su stock."
        />
      )}

      {entrada !== null && sucursalId && (
        <EntradaDialog
          sucursalId={sucursalId}
          stock={entrada === 'nuevo' ? null : entrada}
          onClose={() => setEntrada(null)}
        />
      )}

      {config !== null && sucursalId && (
        <ConfigurarStockDialog
          sucursalId={sucursalId}
          stock={config === 'nuevo' ? null : config}
          onClose={() => setConfig(null)}
        />
      )}
    </div>
  )
}
