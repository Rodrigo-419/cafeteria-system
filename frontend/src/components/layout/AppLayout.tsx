import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/auth/useAuth'
import { MenuIcon, LogOutIcon } from 'lucide-react'
import { cn } from 'cn'
import {
  filtrarMenuAgrupado,
  itemEstaActivo,
  type MenuGrupoVisible,
} from '@/lib/navigation/menu'
import { SubnavegacionGrupo } from './SubnavegacionGrupo'

function NavegacionPrincipal({
  grupos,
  pathname,
  onNavegar,
}: {
  grupos: MenuGrupoVisible[]
  pathname: string
  onNavegar?: () => void
}) {
  return (
    <nav
      aria-label="Navegación principal"
      className="flex-1 space-y-4 overflow-y-auto p-2"
    >
      {grupos.map((grupo, indice) => (
        <div key={grupo.titulo ?? `grupo-${indice}`} className="space-y-1">
          {grupo.titulo && (
            <p className="px-3 pt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {grupo.titulo}
            </p>
          )}
          {grupo.items.map((item) => {
            const activo = itemEstaActivo(item, pathname)
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={activo ? 'page' : undefined}
                onClick={onNavegar}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                  activo && 'bg-primary/10 font-medium text-primary',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-2 shrink-0 rounded-full transition-colors',
                    activo ? 'bg-primary' : 'bg-muted-foreground/40',
                  )}
                />
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function MarcaPanel() {
  return (
    <div className="flex h-14 items-center border-b px-4">
      <Link to="/" className="text-sm font-semibold">
        Sistema de Cafetería
      </Link>
    </div>
  )
}

export function AppLayout() {
  const { usuario, permisos, cerrarSesion } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  const grupos = filtrarMenuAgrupado(permisos, usuario?.sucursalId)

  const handleLogout = () => {
    cerrarSesion()
    // Salida manual: no se conserva la ruta de retorno, y se reemplaza la
    // entrada del historial para que "atras" no vuelva a la pantalla privada.
    navigate('/login', { replace: true })
  }

  const Sidebar = (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <MarcaPanel />
      <NavegacionPrincipal grupos={grupos} pathname={pathname} />
    </aside>
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <div className="hidden md:flex">{Sidebar}</div>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b bg-card px-4">
            <div className="flex items-center gap-2">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    aria-label="Abrir menú"
                  >
                    <MenuIcon className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex flex-col p-0">
                  <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
                  <SheetDescription className="sr-only">
                    Secciones disponibles según tus permisos.
                  </SheetDescription>
                  <MarcaPanel />
                  <NavegacionPrincipal
                    grupos={grupos}
                    pathname={pathname}
                    onNavegar={() => setOpen(false)}
                  />
                </SheetContent>
              </Sheet>
              <span className="text-sm text-muted-foreground">Cafetería</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <span className="max-w-40 truncate">
                    {usuario?.nombre ?? 'Usuario'}
                  </span>
                  {usuario?.rol && (
                    <Badge variant="secondary">{usuario.rol}</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOutIcon className="mr-2 size-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 p-4">
            <SubnavegacionGrupo />
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
