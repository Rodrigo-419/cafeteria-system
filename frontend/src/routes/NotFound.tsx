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

export function NotFound() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Página no encontrada"
        description="La ruta solicitada no existe."
      />
      <Card>
        <CardHeader>
          <CardTitle>404</CardTitle>
          <CardDescription>
            Revisa la dirección o vuelve al inicio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/">Volver al inicio</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
