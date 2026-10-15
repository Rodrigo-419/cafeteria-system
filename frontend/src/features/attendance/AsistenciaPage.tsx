// Pantalla de administración de asistencia.
//
// Reúne en dos pestañas los registros efectivos (con sus correcciones) y las
// faltas de un rango. Requiere `asistencia.ver`; si no se tiene, solo se ofrece
// la pestaña de registros para no romper el acceso de otros permisos.
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import { FaltasTab } from './FaltasTab'
import { RegistrosTab } from './RegistrosTab'

export function AsistenciaPage() {
  const { permisos, usuario } = useAuth()
  const puedeMarcar = tienePermiso(permisos, 'asistencia.marcar')
  const puedeVer = tienePermiso(permisos, 'asistencia.ver')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asistencia"
        description="Registros efectivos, correcciones y control de marcaciones."
        actions={
          puedeMarcar && usuario?.sucursalId != null ? (
            <Button asChild>
              <Link to="/attendance/terminal">Ir al terminal</Link>
            </Button>
          ) : undefined
        }
      />

      {puedeVer ? (
        <Tabs defaultValue="registros">
          <TabsList>
            <TabsTrigger value="registros">Registros</TabsTrigger>
            <TabsTrigger value="faltas">Faltas</TabsTrigger>
          </TabsList>
          <TabsContent value="registros">
            <RegistrosTab />
          </TabsContent>
          <TabsContent value="faltas">
            <FaltasTab />
          </TabsContent>
        </Tabs>
      ) : (
        <RegistrosTab />
      )}
    </div>
  )
}
