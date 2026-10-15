// Detalle de un empleado.
//
// Muestra los datos del vínculo con el usuario y permite las acciones de
// gestión: editar el cargo, generar un PIN de marcación y cesar al empleado. Un
// empleado cesado es `inactivo`: conserva su histórico pero no admite cese ni
// generación de PIN.
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
import { formatearDiaLocal, formatearFechaHora } from '@/lib/format/dates'
import { tienePermiso } from '@/lib/permissions/permissions'
import { CesarEmpleadoDialog } from './CesarEmpleadoDialog'
import { EmpleadoDialog } from './EmpleadoDialog'
import { EstadoEmpleadoBadge } from './EstadoEmpleadoBadge'
import { GenerarPinDialog } from './GenerarPinDialog'
import { mensajeDeError } from './mensajes'
import { useEmpleado, useSucursalesEmpleados } from './queries'

function idCorto(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

export function EmpleadoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const empleadoId = id ?? null
  const { permisos } = useAuth()
  const puedeGestionar = tienePermiso(permisos, 'empleados.crear_editar')

  const [dialogo, setDialogo] = useState<'editar' | 'cesar' | 'pin' | null>(null)

  const empleado = useEmpleado(empleadoId)
  const sucursales = useSucursalesEmpleados(true)

  const nombreSucursal = empleado.data
    ? (sucursales.data?.find((s) => s.id === empleado.data?.sucursalId)?.nombre ??
      idCorto(empleado.data.sucursalId))
    : ''

  const activo = empleado.data?.estado === 'activo'

  return (
    <div className="space-y-6">
      <PageHeader
        title={empleado.data?.usuario.nombre ?? 'Empleado'}
        description={
          empleado.data
            ? `@${empleado.data.usuario.nombreUsuario} · ${empleado.data.cargo} · ${nombreSucursal}`
            : undefined
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/employees">Volver</Link>
            </Button>
            {puedeGestionar && empleado.data && (
              <Button onClick={() => setDialogo('editar')}>Editar cargo</Button>
            )}
            {puedeGestionar && empleado.data && activo && (
              <Button variant="outline" onClick={() => setDialogo('pin')}>
                Generar PIN
              </Button>
            )}
            {puedeGestionar && empleado.data && activo && (
              <Button variant="destructive" onClick={() => setDialogo('cesar')}>
                Cesar
              </Button>
            )}
          </div>
        }
      />

      {empleado.isLoading ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ) : empleado.error ? (
        <ErrorState
          title="No se pudo cargar el empleado"
          description={mensajeDeError(empleado.error, 'detalle')}
          onRetry={() => void empleado.refetch()}
        />
      ) : empleado.data ? (
        <Card>
          <CardHeader>
            <CardTitle>Datos del empleado</CardTitle>
            <CardDescription>
              Empleado registrado en {nombreSucursal}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Estado:</span>
              <EstadoEmpleadoBadge estado={empleado.data.estado} />
            </div>
            <div>
              <span className="text-muted-foreground">Usuario: </span>
              {empleado.data.usuario.nombre} (@
              {empleado.data.usuario.nombreUsuario}) · {empleado.data.usuario.rol}
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-1">
              <span>
                <span className="text-muted-foreground">Cargo: </span>
                {empleado.data.cargo}
              </span>
              <span>
                <span className="text-muted-foreground">Contratación: </span>
                {formatearDiaLocal(empleado.data.fechaContratacion)}
              </span>
              <span>
                <span className="text-muted-foreground">Cese: </span>
                {empleado.data.fechaCese
                  ? formatearDiaLocal(empleado.data.fechaCese)
                  : '—'}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-1 text-muted-foreground">
              <span>Creado: {formatearFechaHora(empleado.data.createdAt)}</span>
              <span>
                Actualizado: {formatearFechaHora(empleado.data.updatedAt)}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {dialogo === 'editar' && empleado.data && (
        <EmpleadoDialog
          empleado={empleado.data}
          onClose={() => setDialogo(null)}
        />
      )}

      {dialogo === 'cesar' && empleado.data && (
        <CesarEmpleadoDialog
          empleado={empleado.data}
          onClose={() => setDialogo(null)}
        />
      )}

      {dialogo === 'pin' && empleado.data && (
        <GenerarPinDialog
          empleado={empleado.data}
          onClose={() => setDialogo(null)}
        />
      )}
    </div>
  )
}
