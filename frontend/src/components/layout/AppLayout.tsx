import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
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
import { MENU_ITEMS, puedeVerItem } from '@/lib/navigation/menu'

export function AppLayout() {
  const { usuario, permisos, cerrarSesion } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const items = MENU_ITEMS.filter((it) => puedeVerItem(it, permisos))

  const handleLogout = () => {
    cerrarSesion()
    navigate('/login')
  }

  const Sidebar = (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-4">
        <Link to="/" className="text-sm font-semibold">
          Sistema de Cafetería
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                isActive && 'bg-accent text-accent-foreground',
              )
            }
            onClick={() => setOpen(false)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <div className="hidden md:flex">{Sidebar}</div>
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b bg-card px-4">
            <div className="flex items-center gap-2">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <MenuIcon className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0">
                  {Sidebar}
                </SheetContent>
              </Sheet>
              <span className="text-sm text-muted-foreground">Cafetería</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  {usuario?.nombre ?? 'Usuario'} — {usuario?.rol ?? '-'}
                  {usuario?.sucursalId ? ' — ' + usuario.sucursalId : ''}
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
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
