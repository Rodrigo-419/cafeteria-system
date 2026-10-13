import { PageHeader } from '@/components/shared/PageHeader'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function ComingSoonPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Próximamente"
        description="Todavía no está disponible."
      />
      <Card>
        <CardHeader>
          <CardTitle>En desarrollo</CardTitle>
          <CardDescription>Estamos trabajando en este módulo.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Gracias por tu paciencia.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
