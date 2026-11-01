// Bitácora de auditoría (solo lectura).
//
// Lista paginada de eventos del log, con filtros por sucursal (solo Admin),
// entidad, acción y rango de fechas locales. El backend es la autoridad del
// alcance (el Gerente solo ve los eventos de su sucursal) y de las reglas del
// rango (máximo 92 días): el frontend no filtra por cliente. Cada fila resume
// quién hizo qué, sobre qué entidad y cuándo; pulsar la fila, o el botón de la
// acción desde el teclado, abre el resumen antes → después.
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { BotonExportar } from '@/features/exports/BotonExportar'
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
  const botonesAccion = useRef(new Map<string, HTMLButtonElement>())
  const ultimoEventoAbierto = useRef<string | null>(null)

  // El diálogo devuelve el foco al elemento activo al abrirse (Radix), pero un
  // clic en la fila no es un elemento enfocable. Al cerrar, se devuelve el foco
  // al botón de la acción del evento que abrió el diálogo.
  useEffect(() => {
    if (seleccionado !== null) return
    const id = ultimoEventoAbierto.current
    if (id === null) return
    ultimoEventoAbierto.current = null
    const temporizador = window.setTimeout(() => {
      botonesAccion.current.get(id)?.focus()
    }, 0)
    return () => window.clearTimeout(temporizador)
  }, [seleccionado])

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

  function abrirDetalle(fila: EventoAuditoriaApi) {
    ultimoEventoAbierto.current = fila.id
    // Con un clic en la fila el foco aún no está en el botón de la acción: se
    // mueve aquí para que el diálogo tenga un origen de foco claro.
    botonesAccion.current.get(fila.id)?.focus()
    setSeleccionado(fila)
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
      cell: (fila) => {
        const etiqueta = etiquetaAccion(fila.accion)
        return (
          <button
            type="button"
            ref={(elemento) => {
              if (elemento) botonesAccion.current.set(fila.id, elemento)
              else botonesAccion.current.delete(fila.id)
            }}
            aria-label={`Ver detalle: ${etiqueta}`}
            aria-haspopup="dialog"
            className="rounded-sm font-medium text-foreground outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {etiqueta}
          </button>
        )
      },
    },
    {
      key: 'entidad',
      header: 'Entidad',
      cell: (fila) => etiquetaEntidad(fila.entidad),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bitácora de auditoría"
        description="Registro de acciones realizadas sobre el sistema"
        actions={<BotonExportar conjunto="auditoria" />}
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
        onFilaClick={abrirDetalle}
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
