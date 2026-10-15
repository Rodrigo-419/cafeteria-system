// Catálogo de turnos con filtros por sucursal y tipo.
//
// El Admin ve todas las sucursales y puede filtrar por sucursal; el Gerente solo
// ve los turnos de la suya (el backend acota el alcance). No hay borrado: los
// turnos se crean y se editan, y se muestran con su tipo como badge.
import { useMemo, useState } from 'react'
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
import { mensajeDeError } from './mensajes'
import {
  ETIQUETA_TIPO_TURNO,
  formatearDias,
  formatearHorario,
  TIPOS_TURNO,
} from './presentacion'
import { useSucursalesTurnos, useTurnos } from './queries'
import { TipoTurnoBadge } from './TipoTurnoBadge'
import { TurnoDialog } from './TurnoDialog'
import type { TipoTurno, TurnoApi } from '@/types/api'

const PAGE_SIZE = 10

function idCorto(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

type Dialogo = { tipo: 'crear' } | { tipo: 'editar'; turno: TurnoApi } | null

export function TurnosPage() {
  const { usuario, permisos } = useAuth()
  const esAdmin = usuario?.rol === 'Admin'
  const puedeGestionar = tienePermiso(permisos, 'turnos.editar')

  const [page, setPage] = useState(1)
  const [tipo, setTipo] = useState<TipoTurno | 'todos'>('todos')
  const [sucursalAdmin, setSucursalAdmin] = useState('todas')
  const [dialogo, setDialogo] = useState<Dialogo>(null)

  const sucursales = useSucursalesTurnos(esAdmin)

  const filtros = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(tipo !== 'todos' ? { tipo } : {}),
      ...(esAdmin && sucursalAdmin !== 'todas'
        ? { sucursalId: sucursalAdmin }
        : {}),
    }),
    [page, tipo, esAdmin, sucursalAdmin],
  )

  const { data, isLoading, error, refetch } = useTurnos(filtros)

  const nombresSucursal = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const sucursal of sucursales.data ?? []) {
      mapa.set(sucursal.id, sucursal.nombre)
    }
    return mapa
  }, [sucursales.data])

  const columnas: Column<TurnoApi>[] = [
    {
      key: 'tipo',
      header: 'Tipo',
      cell: (turno) => <TipoTurnoBadge tipo={turno.tipo} />,
    },
    {
      key: 'horario',
      header: 'Horario',
      cell: (turno) => formatearHorario(turno.horaInicio, turno.horaFin),
    },
    {
      key: 'dias',
      header: 'Días',
      cell: (turno) => formatearDias(turno.diasSemana),
    },
    ...(esAdmin
      ? [
          {
            key: 'sucursal',
            header: 'Sucursal',
            cell: (turno: TurnoApi) =>
              nombresSucursal.get(turno.sucursalId) ?? idCorto(turno.sucursalId),
          } satisfies Column<TurnoApi>,
        ]
      : []),
    {
      key: 'acciones',
      header: '',
      className: 'text-right',
      cell: (turno) =>
        puedeGestionar ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDialogo({ tipo: 'editar', turno })}
          >
            Editar
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Turnos"
        description="Turnos fijos y variables de cada sucursal"
        actions={
          puedeGestionar ? (
            <Button onClick={() => setDialogo({ tipo: 'crear' })}>
              <PlusIcon className="size-4" />
              Crear turno
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="turno-filtro-tipo">Tipo</Label>
            <Select
              value={tipo}
              onValueChange={(valor) => {
                setTipo(valor as TipoTurno | 'todos')
                setPage(1)
              }}
            >
              <SelectTrigger id="turno-filtro-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {TIPOS_TURNO.map((valor) => (
                  <SelectItem key={valor} value={valor}>
                    {ETIQUETA_TIPO_TURNO[valor]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {esAdmin && (
            <div className="space-y-2">
              <Label htmlFor="turno-filtro-sucursal">Sucursal</Label>
              <Select
                value={sucursalAdmin}
                onValueChange={(valor) => {
                  setSucursalAdmin(valor)
                  setPage(1)
                }}
              >
                <SelectTrigger id="turno-filtro-sucursal">
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
        getRowId={(turno) => turno.id}
        emptyTitle="Sin turnos"
        emptyDescription="No hay turnos que coincidan con los filtros en tu alcance."
      />

      {dialogo !== null && (
        <TurnoDialog
          turno={dialogo.tipo === 'editar' ? dialogo.turno : null}
          onClose={() => setDialogo(null)}
        />
      )}
    </div>
  )
}
