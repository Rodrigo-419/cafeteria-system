import { PageHeader } from '@/components/shared/PageHeader'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/lib/auth/useAuth'

export function DashboardPage() {
  const { usuario } = useAuth()
  const desc = usuario ? 'Hola, ' + usuario.nombre : undefined

  return (
    <div className="space-y-6">
      <PageHeader title="Bienvenido" description={desc} />
      <Card>
        <CardHeader>
          <CardTitle>Panel principal</CardTitle>
          <CardDescription>
            Resumen general del sistema de cafetería.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Usa el menú lateral para navegar por los módulos según tus permisos.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
