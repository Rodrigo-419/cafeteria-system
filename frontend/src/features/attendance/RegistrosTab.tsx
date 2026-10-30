// Pestaña de registros efectivos de asistencia (G2).
//
// Lista los registros visibles para el usuario con filtros por día de negocio
// (America/Lima) y por estado (abiertas). Cada fila abre su historial de
// correcciones y, si el usuario tiene `asistencia.corregir`, permite corregirla.
// El alcance real lo aplica el backend; aquí no se replica esa regla.
import { useState } from 'react'
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
import { StatusPill } from '@/components/shared/StatusPill'
import { useAuth } from '@/lib/auth/useAuth'
import { formatearFechaHora } from '@/lib/format/dates'
import { tienePermiso } from '@/lib/permissions/permissions'
import { mensajeDeError } from '@/features/attendance/mensajes'
import {
  etiquetaMetodo,
  etiquetaTipo,
  tonoTipo,
} from '@/features/attendance/presentacion'
import { useRegistrosAsistencia } from '@/features/attendance/queries'
import { BotonExportar } from '@/features/exports/BotonExportar'
import { CorregirRegistroDialog } from './CorregirRegistroDialog'
import { RegistroDetalleDialog } from './RegistroDetalleDialog'
import type { RegistroAsistenciaApi } from '@/types/api'

const PAGE_SIZE = 10

export function RegistrosTab() {
  const { permisos } = useAuth()
  const puedeCorregir = tienePermiso(permisos, 'asistencia.corregir')

  const [page, setPage] = useState(1)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [estado, setEstado] = useState<'todas' | 'abiertas'>('todas')
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const [corregir, setCorregir] = useState<RegistroAsistenciaApi | null>(null)

  const registros = useRegistrosAsistencia({
    page,
    limit: PAGE_SIZE,
    ...(desde !== '' ? { desde } : {}),
    ...(hasta !== '' ? { hasta } : {}),
    ...(estado === 'abiertas' ? { abierta: true } : {}),
  })

  const columnas: Column<RegistroAsistenciaApi>[] = [
    {
      key: 'colaborador',
      header: 'Colaborador',
      cell: (registro) => (
        <span className="font-medium">{registro.empleado.nombre}</span>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      cell: (registro) => (
        <StatusPill tono={tonoTipo(registro.tipo)}>
          {etiquetaTipo(registro.tipo)}
        </StatusPill>
      ),
    },
    {
      key: 'fechaHora',
      header: 'Fecha y hora',
      cell: (registro) => (
        <span className="tabular-nums">
          {formatearFechaHora(registro.fechaHora)}
        </span>
      ),
    },
    {
      key: 'metodo',
      header: 'Método',
      cell: (registro) => etiquetaMetodo(registro.metodo),
    },
    {
      key: 'estado',
      header: 'Estado',
      cell: (registro) => (
        <div className="flex flex-wrap gap-1">
          <StatusPill tono={registro.abierta ? 'warning' : 'neutral'}>
            {registro.abierta ? 'Abierta' : 'Cerrada'}
          </StatusPill>
          {registro.corregido && <StatusPill tono="info">Corregida</StatusPill>}
        </div>
      ),
    },
    {
      key: 'acciones',
      header: '',
      className: 'text-right',
      cell: (registro) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDetalleId(registro.id)}
          >
            Historial
          </Button>
          {puedeCorregir && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCorregir(registro)}
            >
              Corregir
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="asistencia-desde">Desde</Label>
            <Input
              id="asistencia-desde"
              type="date"
              value={desde}
              onChange={(evento) => {
                setDesde(evento.target.value)
                setPage(1)
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="asistencia-hasta">Hasta</Label>
            <Input
              id="asistencia-hasta"
              type="date"
              value={hasta}
              onChange={(evento) => {
                setHasta(evento.target.value)
                setPage(1)
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="asistencia-estado">Estado</Label>
            <Select
              value={estado}
              onValueChange={(valor) => {
                setEstado(valor as 'todas' | 'abiertas')
                setPage(1)
              }}
            >
              <SelectTrigger id="asistencia-estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="abiertas">Solo abiertas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <BotonExportar
          conjunto="asistencia"
          desde={desde}
          hasta={hasta}
        />
      </div>

      <DataTable
        columns={columnas}
        data={registros.data?.items ?? []}
        isLoading={registros.isLoading}
        error={
          registros.error ? mensajeDeError(registros.error, 'listar') : null
        }
        onRetry={() => void registros.refetch()}
        page={page}
        pageSize={PAGE_SIZE}
        total={registros.data?.total}
        onPageChange={setPage}
        getRowId={(registro) => registro.id}
        emptyTitle="Sin registros"
        emptyDescription="No hay marcaciones que coincidan con los filtros en tu alcance."
      />

      {detalleId && (
        <RegistroDetalleDialog
          id={detalleId}
          puedeCorregir={puedeCorregir}
          onCerrar={() => setDetalleId(null)}
          onCorregir={(registro) => {
            setDetalleId(null)
            setCorregir(registro)
          }}
        />
      )}

      {corregir && (
        <CorregirRegistroDialog
          registro={corregir}
          onClose={() => setCorregir(null)}
        />
      )}
    </div>
  )
}
