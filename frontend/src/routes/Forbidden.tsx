import { PageHeader } from '@/components/shared/PageHeader'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

export function Forbidden() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Acceso denegado"
        description="No tienes permisos para acceder a esta sección."
      />
      <Card>
        <CardHeader>
          <CardTitle>403</CardTitle>
          <CardDescription>
            Verifica tus permisos con el administrador.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Button asChild>
            <Link to="/">Volver al inicio</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/login">Ir a login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
