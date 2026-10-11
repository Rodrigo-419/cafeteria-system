import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import {
  AccesosRapidos,
  AlertasStock,
  AsistenciaAbierta,
  EquiposResumen,
  ReporteComparativoSucursales,
  ResumenVentasHoy,
  SinResumen,
  UltimasVentas,
} from '@/features/dashboard/blocks'

// El panel se compone por PERMISOS EFECTIVOS, nunca por rol. Cada bloque se
// monta solo si el usuario tiene el permiso que exige su ruta: así tampoco se
// dispara ninguna llamada a una ruta no permitida.
export function DashboardPage() {
  const { usuario, permisos } = useAuth()

  const puedeVentas = tienePermiso(permisos, 'ventas.ver')
  const puedeAlertas = tienePermiso(permisos, 'alertas.ver_resolver')
  const puedeAsistencia = tienePermiso(permisos, 'asistencia.ver')
  const puedeEquipos = tienePermiso(permisos, 'equipo.ver')
  const puedeReporte = tienePermiso(permisos, 'reportes.comparativos.ver')

  const hayResumen =
    puedeVentas || puedeAlertas || puedeAsistencia || puedeEquipos || puedeReporte

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel de control"
        description={usuario ? `Hola, ${usuario.nombre}` : undefined}
        actions={<AccesosRapidos />}
      />

      {puedeVentas && <ResumenVentasHoy />}

      <div className="grid gap-6 lg:grid-cols-2">
        {puedeVentas && <UltimasVentas />}
        {puedeAlertas && <AlertasStock />}
        {puedeAsistencia && <AsistenciaAbierta />}
        {puedeEquipos && <EquiposResumen />}
      </div>

      {puedeReporte && <ReporteComparativoSucursales />}

      {!hayResumen && <SinResumen />}
    </div>
  )
}
