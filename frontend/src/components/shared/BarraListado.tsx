import { useId, useState, type ReactNode } from 'react'
import { SearchIcon, SlidersHorizontalIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface BusquedaListado {
  value: string
  onChange: (valor: string) => void
  placeholder?: string
  label?: string
  id?: string
}

export interface BarraListadoProps {
  /** Búsqueda a la izquierda. Si la API del listado no la admite, se omite. */
  busqueda?: BusquedaListado
  /** Filtros secundarios; se muestran en un panel plegable. */
  filtros?: ReactNode
  /** Número de filtros secundarios activos (sin contar la búsqueda). */
  filtrosActivos?: number
  /** Acción primaria a la derecha (p. ej. "Crear usuario"). */
  accionPrimaria?: ReactNode
}

/**
 * Barra de listado reutilizable: búsqueda a la izquierda, filtros secundarios
 * plegados en un panel (con contador de activos) y acción primaria a la
 * derecha. No define estilos por página: solo tokens y componentes del tema.
 */
export function BarraListado({
  busqueda,
  filtros,
  filtrosActivos = 0,
  accionPrimaria,
}: BarraListadoProps) {
  const [panelAbierto, setPanelAbierto] = useState(false)
  const idPanel = useId()
  const idBusqueda = busqueda?.id ?? `${idPanel}-busqueda`
  const etiquetaBusqueda = busqueda?.label ?? 'Buscar'

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {busqueda ? (
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor={idBusqueda}>{etiquetaBusqueda}</Label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id={idBusqueda}
                  className="pl-9"
                  value={busqueda.value}
                  placeholder={busqueda.placeholder}
                  onChange={(evento) => busqueda.onChange(evento.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="min-w-0 flex-1" />
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {filtros && (
              <Button
                type="button"
                variant="outline"
                aria-expanded={panelAbierto}
                aria-controls={idPanel}
                onClick={() => setPanelAbierto((abierto) => !abierto)}
              >
                <SlidersHorizontalIcon className="size-4" />
                Filtros
                {filtrosActivos > 0 && (
                  <Badge
                    variant="secondary"
                    aria-label={`${filtrosActivos} filtros activos`}
                  >
                    {filtrosActivos}
                  </Badge>
                )}
              </Button>
            )}
            {accionPrimaria}
          </div>
        </div>
        {filtros && panelAbierto && (
          <div
            id={idPanel}
            role="group"
            aria-label="Filtros del listado"
            className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filtros}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
