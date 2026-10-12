// Detalle de un equipo con su historial en línea de tiempo.
//
// El historial solo tiene entradas cuando cambió el estado o las observaciones
// (con autor y fecha). Un equipo retirado es terminal: no ofrece cambio de
// estado, pero su nombre, tipo y observaciones sí se pueden editar.
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/lib/auth/useAuth'
import { formatearFechaHora } from '@/lib/format/dates'
import { tienePermiso } from '@/lib/permissions/permissions'
import { CambiarEstadoDialog } from './CambiarEstadoDialog'
import { EquipoDialog } from './EquipoDialog'
import { EstadoEquipoBadge } from './EstadoEquipoBadge'
import { HistorialEquipoTimeline } from './HistorialEquipoTimeline'
import { mensajeDeError } from './mensajes'
import { esEstadoTerminal } from './presentacion'
import {
  useEquipo,
  useHistorialEquipo,
  useSucursalesEquipos,
} from './queries'

function idCorto(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

export function EquipoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const equipoId = id ?? null
  const { permisos } = useAuth()
  const puedeEditar = tienePermiso(permisos, 'equipo.registrar_editar')

  const [dialogo, setDialogo] = useState<'editar' | 'estado' | null>(null)

  const equipo = useEquipo(equipoId)
  const historial = useHistorialEquipo(equipoId)
  const sucursales = useSucursalesEquipos(true)

  const nombreSucursal = equipo.data
    ? (sucursales.data?.find((s) => s.id === equipo.data?.sucursalId)?.nombre ??
      idCorto(equipo.data.sucursalId))
    : ''

  const terminal = equipo.data ? esEstadoTerminal(equipo.data.estado) : false

  return (
    <div className="space-y-6">
      <PageHeader
        title={equipo.data?.nombre ?? 'Equipo'}
        description={
          equipo.data ? `${equipo.data.tipo} · ${nombreSucursal}` : undefined
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/equipment">Volver</Link>
            </Button>
            {puedeEditar && equipo.data && (
              <Button onClick={() => setDialogo('editar')}>Editar</Button>
            )}
            {puedeEditar && equipo.data && !terminal && (
              <Button variant="outline" onClick={() => setDialogo('estado')}>
                Cambiar estado
              </Button>
            )}
          </div>
        }
      />

      {equipo.isLoading ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ) : equipo.error ? (
        <ErrorState
          title="No se pudo cargar el equipo"
          description={mensajeDeError(equipo.error, 'detalle')}
          onRetry={() => void equipo.refetch()}
        />
      ) : equipo.data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Datos del equipo</CardTitle>
              <CardDescription>
                Equipo registrado en {nombreSucursal}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Estado:</span>
                <EstadoEquipoBadge estado={equipo.data.estado} />
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-1">
                <span>
                  <span className="text-muted-foreground">Tipo: </span>
                  {equipo.data.tipo}
                </span>
                <span>
                  <span className="text-muted-foreground">Registrado: </span>
                  {formatearFechaHora(equipo.data.createdAt)}
                </span>
                <span>
                  <span className="text-muted-foreground">Actualizado: </span>
                  {formatearFechaHora(equipo.data.updatedAt)}
                </span>
              </div>
              <div>
                <p className="text-muted-foreground">Observaciones</p>
                <p className="whitespace-pre-wrap">
                  {equipo.data.observaciones ?? 'Sin observaciones.'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historial</CardTitle>
              <CardDescription>
                Cambios de estado y observaciones, con su autor y fecha.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HistorialEquipoTimeline
                datos={historial.data?.data ?? []}
                isLoading={historial.isLoading}
                error={
                  historial.error
                    ? mensajeDeError(historial.error, 'historial')
                    : null
                }
                onRetry={() => void historial.refetch()}
              />
            </CardContent>
          </Card>
        </>
      ) : null}

      {dialogo === 'editar' && equipo.data && (
        <EquipoDialog equipo={equipo.data} onClose={() => setDialogo(null)} />
      )}

      {dialogo === 'estado' && equipo.data && (
        <CambiarEstadoDialog
          equipo={equipo.data}
          onClose={() => setDialogo(null)}
        />
      )}
    </div>
  )
}
