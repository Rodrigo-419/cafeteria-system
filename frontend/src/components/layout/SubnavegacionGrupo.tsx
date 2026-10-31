import { Link, useLocation } from 'react-router-dom'
import { cn } from 'cn'
import { useAuth } from '@/lib/auth/useAuth'
import {
  grupoDeRuta,
  rutaBase,
  subpaginaEstaActiva,
  type MenuSubItemConfig,
} from '@/lib/navigation/menu'

/**
 * Subnavegación de un grupo del menú (Inventario, Productos, Turnos).
 *
 * Pinta pestañas con enlaces a las rutas existentes, solo las que el usuario
 * puede ver y solo si hay más de una. Es accesible por teclado y marca la
 * pestaña actual con `aria-current="page"`.
 */
export function SubnavegacionGrupo() {
  const { permisos, usuario } = useAuth()
  const { pathname, search } = useLocation()

  const contexto = grupoDeRuta(permisos, pathname, usuario?.sucursalId)
  if (!contexto) return null

  const { item } = contexto
  const subpaginas = item.subpaginasVisibles
  if (subpaginas.length < 2) return null

  // Si varias subpáginas comparten la misma ruta base (Catálogo/Carta) o una es
  // prefijo de otra (`/shifts` y `/shifts/calendario-horas`), gana la más
  // específica: la ruta base más larga y, a igualdad, la que declara query
  // string y coincide con la URL.
  const candidatas = subpaginas.filter((subpagina) =>
    subpaginaEstaActiva(subpagina, pathname, search),
  )
  const activa: MenuSubItemConfig | undefined = [...candidatas].sort((a, b) => {
    const porLongitud = rutaBase(b.to).length - rutaBase(a.to).length
    if (porLongitud !== 0) return porLongitud
    return Number(b.to.includes('?')) - Number(a.to.includes('?'))
  })[0]

  return (
    <nav
      aria-label={`Subnavegación de ${item.label}`}
      className="mb-6 flex flex-wrap items-center gap-1 border-b border-border pb-2"
    >
      {subpaginas.map((subpagina) => {
        const esActiva = subpagina === activa
        return (
          <Link
            key={subpagina.to}
            to={subpagina.to}
            aria-current={esActiva ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              esActiva
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {subpagina.label}
          </Link>
        )
      })}
    </nav>
  )
}
