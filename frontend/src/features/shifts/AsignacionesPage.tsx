// Listado de asignaciones de turno con filtros por empleado, turno y vigencia.
//
// El Admin ve todas las sucursales; el Gerente solo las de la suya (el backend
// acota el alcance). Una asignación se retira fijando su fecha de fin: las ya
// finalizadas no ofrecen la acción. El estado (programada/vigente/finalizada) se
// calcula sobre el día de negocio en Lima.
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
import { diaDeNegocioLima } from '@/lib/format/dates'
import { tienePermiso } from '@/lib/permissions/permissions'
import { useEmpleados } from '@/features/employees/queries'
import { AsignacionDialog } from './AsignacionDialog'
import { EstadoAsignacionBadge } from './EstadoAsignacionBadge'
import { mensajeDeError } from './mensajes'
import {
  ETIQUETA_TIPO_TURNO,
  estadoAsignacion,
  formatearDias,
  formatearHorario,
  formatearVigencia,
} from './presentacion'
import {
  LIMITE_LISTA,
  useAsignaciones,
  useSucursalesTurnos,
  useTurnos,
} from './queries'
import { RetirarAsignacionDialog } from './RetirarAsignacionDialog'
import { TipoTurnoBadge } from './TipoTurnoBadge'
import type { AsignacionApi } from '@/types/api'

const PAGE_SIZE = 10

type Dialogo = { tipo: 'crear' } | { tipo: 'retirar'; asignacion: AsignacionApi } | null

export function AsignacionesPage() {
  const { usuario, permisos } = useAuth()
  const esAdmin = usuario?.rol === 'Admin'
  const puedeGestionar = tienePermiso(permisos, 'turnos.editar')

  const [page, setPage] = useState(1)
  const [empleadoId, setEmpleadoId] = useState('todos')
  const [turnoId, setTurnoId] = useState('todos')
  const [vigencia, setVigencia] = useState<'todas' | 'vigentes'>('todas')
  const [dialogo, setDialogo] = useState<Dialogo>(null)

  const sucursales = useSucursalesTurnos(esAdmin)
  const empleados = useEmpleados({ page: 1, limit: LIMITE_LISTA })
  const turnos = useTurnos({ page: 1, limit: LIMITE_LISTA })

  const filtros = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(empleadoId !== 'todos' ? { empleadoId } : {}),
      ...(turnoId !== 'todos' ? { turnoId } : {}),
      ...(vigencia === 'vigentes' ? { vigente: true } : {}),
    }),
    [page, empleadoId, turnoId, vigencia],
  )

  const { data, isLoading, error, refetch } = useAsignaciones(filtros)
  const hoy = diaDeNegocioLima(new Date())

  const nombresSucursal = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const sucursal of sucursales.data ?? []) {
      mapa.set(sucursal.id, sucursal.nombre)
    }
    return mapa
  }, [sucursales.data])

  const columnas: Column<AsignacionApi>[] = [
    {
      key: 'colaborador',
      header: 'Colaborador',
      cell: (asignacion) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {asignacion.empleado.usuario.nombre}
          </span>
          <span className="text-xs text-muted-foreground">
            {asignacion.empleado.cargo}
          </span>
        </div>
      ),
    },
    {
      key: 'turno',
      header: 'Turno',
      cell: (asignacion) => (
        <div className="flex items-center gap-2">
          <TipoTurnoBadge tipo={asignacion.turno.tipo} />
          <span className="text-sm text-muted-foreground">
            {formatearHorario(asignacion.turno.horaInicio, asignacion.turno.horaFin)}
          </span>
        </div>
      ),
    },
    {
      key: 'dias',
      header: 'Días',
      cell: (asignacion) => formatearDias(asignacion.turno.diasSemana),
    },
    ...(esAdmin
      ? [
          {
            key: 'sucursal',
            header: 'Sucursal',
            cell: (asignacion: AsignacionApi) =>
              nombresSucursal.get(asignacion.empleado.sucursalId) ??
              asignacion.empleado.sucursalId,
          } satisfies Column<AsignacionApi>,
        ]
      : []),
    {
      key: 'vigencia',
      header: 'Vigencia',
      cell: (asignacion) => (
        <div className="flex flex-col gap-1">
          <span className="text-sm">
            {formatearVigencia(asignacion.fechaInicio, asignacion.fechaFin)}
          </span>
          <EstadoAsignacionBadge estado={estadoAsignacion(asignacion, hoy)} />
        </div>
      ),
    },
    {
      key: 'acciones',
      header: '',
      className: 'text-right',
      cell: (asignacion) =>
        puedeGestionar && estadoAsignacion(asignacion, hoy) !== 'finalizada' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDialogo({ tipo: 'retirar', asignacion })}
          >
            Retirar
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asignaciones"
        description="Turnos asignados a los colaboradores"
        actions={
          puedeGestionar ? (
            <Button onClick={() => setDialogo({ tipo: 'crear' })}>
              <PlusIcon className="size-4" />
              Asignar turno
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="asignacion-filtro-empleado">Empleado</Label>
            <Select
              value={empleadoId}
              onValueChange={(valor) => {
                setEmpleadoId(valor)
                setPage(1)
              }}
            >
              <SelectTrigger id="asignacion-filtro-empleado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(empleados.data?.data ?? []).map((empleado) => (
                  <SelectItem key={empleado.id} value={empleado.id}>
                    {empleado.usuario.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="asignacion-filtro-turno">Turno</Label>
            <Select
              value={turnoId}
              onValueChange={(valor) => {
                setTurnoId(valor)
                setPage(1)
              }}
            >
              <SelectTrigger id="asignacion-filtro-turno">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(turnos.data?.data ?? []).map((turno) => (
                  <SelectItem key={turno.id} value={turno.id}>
                    {ETIQUETA_TIPO_TURNO[turno.tipo]} ·{' '}
                    {formatearHorario(turno.horaInicio, turno.horaFin)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="asignacion-filtro-vigencia">Vigencia</Label>
            <Select
              value={vigencia}
              onValueChange={(valor) => {
                setVigencia(valor as 'todas' | 'vigentes')
                setPage(1)
              }}
            >
              <SelectTrigger id="asignacion-filtro-vigencia">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="vigentes">Vigentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
        getRowId={(asignacion) => asignacion.id}
        emptyTitle="Sin asignaciones"
        emptyDescription="No hay asignaciones que coincidan con los filtros en tu alcance."
      />

      {dialogo?.tipo === 'crear' && (
        <AsignacionDialog onClose={() => setDialogo(null)} />
      )}

      {dialogo?.tipo === 'retirar' && (
        <RetirarAsignacionDialog
          asignacion={dialogo.asignacion}
          onClose={() => setDialogo(null)}
        />
      )}
    </div>
  )
}
