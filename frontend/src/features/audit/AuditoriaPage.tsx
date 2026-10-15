// Bitácora de auditoría (solo lectura).
//
// Lista paginada de eventos del log, con filtros por sucursal (solo Admin),
// entidad, acción y rango de fechas locales. El backend es la autoridad del
// alcance (el Gerente solo ve los eventos de su sucursal) y de las reglas del
// rango (máximo 92 días): el frontend no filtra por cliente. Cada fila resume
// quién hizo qué, sobre qué entidad y cuándo; el botón "Ver detalle" abre el
// resumen antes → después.
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/lib/auth/useAuth'
import { formatearFechaHora } from '@/lib/format/dates'
import {
  ACCIONES_POR_AREA,
  ENTIDADES_AUDITORIA,
  ETIQUETA_AREA,
  ETIQUETA_ENTIDAD,
  etiquetaAccion,
  etiquetaEntidad,
} from '@/lib/auditoria/etiquetas'
import { EventoAuditoriaDialog } from './EventoAuditoriaDialog'
import { mensajeDeError } from './mensajes'
import { useAuditoria, useSucursalesAuditoria } from './queries'
import type { AccionAuditoria, EntidadAuditoria, EventoAuditoriaApi } from '@/types/api'

const PAGE_SIZE = 20

export function AuditoriaPage() {
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'Admin'

  const [sucursalAdmin, setSucursalAdmin] = useState('')
  const [entidad, setEntidad] = useState<EntidadAuditoria | 'todas'>('todas')
  const [accion, setAccion] = useState<AccionAuditoria | 'todas'>('todas')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [page, setPage] = useState(1)
  const [seleccionado, setSeleccionado] = useState<EventoAuditoriaApi | null>(
    null,
  )

  const sucursales = useSucursalesAuditoria(esAdmin)

  const filtros = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(esAdmin && sucursalAdmin !== '' ? { sucursalId: sucursalAdmin } : {}),
      ...(entidad !== 'todas' ? { entidad } : {}),
      ...(accion !== 'todas' ? { accion } : {}),
      ...(desde !== '' ? { desde } : {}),
      ...(hasta !== '' ? { hasta } : {}),
    }),
    [page, esAdmin, sucursalAdmin, entidad, accion, desde, hasta],
  )

  const auditoria = useAuditoria(filtros)

  function reiniciar(accionReset: () => void) {
    accionReset()
    setPage(1)
  }

  const columnas: Column<EventoAuditoriaApi>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      cell: (fila) => formatearFechaHora(fila.fecha),
    },
    {
      key: 'actor',
      header: 'Quién',
      cell: (fila) => (
        <div className="space-y-0.5">
          <p className="font-medium">{fila.actor.nombre}</p>
          <p className="text-xs text-muted-foreground">
            @{fila.actor.nombreUsuario}
          </p>
        </div>
      ),
    },
    {
      key: 'accion',
      header: 'Acción',
      cell: (fila) => etiquetaAccion(fila.accion),
    },
    {
      key: 'entidad',
      header: 'Entidad',
      cell: (fila) => etiquetaEntidad(fila.entidad),
    },
    {
      key: 'detalle',
      header: 'Detalle',
      className: 'text-right',
      cell: (fila) => (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSeleccionado(fila)}
          >
            Ver detalle
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bitácora de auditoría"
        description="Registro de acciones realizadas sobre el sistema"
      />

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-5">
          {esAdmin && (
            <div className="space-y-2">
              <Label htmlFor="auditoria-sucursal">Sucursal</Label>
              <Select
                value={sucursalAdmin}
                onValueChange={(valor) =>
                  reiniciar(() => setSucursalAdmin(valor))
                }
              >
                <SelectTrigger id="auditoria-sucursal">
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
            <Label htmlFor="auditoria-entidad">Entidad</Label>
            <Select
              value={entidad}
              onValueChange={(valor) =>
                reiniciar(() =>
                  setEntidad(valor as EntidadAuditoria | 'todas'),
                )
              }
            >
              <SelectTrigger id="auditoria-entidad">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {ENTIDADES_AUDITORIA.map((valor) => (
                  <SelectItem key={valor} value={valor}>
                    {ETIQUETA_ENTIDAD[valor]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auditoria-accion">Acción</Label>
            <Select
              value={accion}
              onValueChange={(valor) =>
                reiniciar(() => setAccion(valor as AccionAuditoria | 'todas'))
              }
            >
              <SelectTrigger id="auditoria-accion">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {ACCIONES_POR_AREA.map((grupo) => (
                  <SelectGroup key={grupo.area}>
                    <SelectLabel>{ETIQUETA_AREA[grupo.area]}</SelectLabel>
                    {grupo.acciones.map((valor) => (
                      <SelectItem key={valor} value={valor}>
                        {etiquetaAccion(valor)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auditoria-desde">Desde</Label>
            <Input
              id="auditoria-desde"
              type="date"
              value={desde}
              onChange={(evento) =>
                reiniciar(() => setDesde(evento.target.value))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auditoria-hasta">Hasta</Label>
            <Input
              id="auditoria-hasta"
              type="date"
              value={hasta}
              onChange={(evento) =>
                reiniciar(() => setHasta(evento.target.value))
              }
            />
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columnas}
        data={auditoria.data?.eventos ?? []}
        isLoading={auditoria.isLoading}
        error={
          auditoria.error ? mensajeDeError(auditoria.error, 'listar') : null
        }
        onRetry={() => void auditoria.refetch()}
        page={page}
        pageSize={PAGE_SIZE}
        total={auditoria.data?.total}
        onPageChange={setPage}
        getRowId={(fila) => fila.id}
        emptyTitle="Sin eventos"
        emptyDescription="No hay eventos que coincidan con los filtros."
      />

      {seleccionado && (
        <EventoAuditoriaDialog
          evento={seleccionado}
          onClose={() => setSeleccionado(null)}
        />
      )}
    </div>
  )
}
