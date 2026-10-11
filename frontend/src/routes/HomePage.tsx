import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/lib/auth/useAuth'
import { Can } from '@/lib/permissions/Can'

export function HomePage() {
  const { usuario, cerrarSesion } = useAuth()

  return (
    <div className="min-h-svh bg-muted p-6">
      <div className="mx-auto grid max-w-3xl gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Hola, {usuario?.nombre}</h1>
            <p className="text-muted-foreground text-sm">
              {usuario?.email} · {usuario?.rol ?? 'Sin rol'}
            </p>
          </div>
          <Button variant="outline" onClick={cerrarSesion}>
            Cerrar sesión
          </Button>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Panel</CardTitle>
            <CardDescription>
              Base del frontend (etapas E0 y E1). Los módulos de negocio llegan
              en las siguientes etapas.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <p className="text-muted-foreground text-sm">
              Permisos efectivos: {usuario?.permisos.length ?? 0}
            </p>
            <Can permiso="ventas.ver">
              <p className="text-sm">Tenés acceso al módulo de ventas.</p>
            </Can>
            <Can
              permiso="reportes.comparativos.ver"
              fallback={
                <p className="text-muted-foreground text-sm">
                  Los reportes comparativos no están disponibles para tu
                  usuario.
                </p>
              }
            >
              <p className="text-sm">
                Tenés acceso a los reportes comparativos.
              </p>
            </Can>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
