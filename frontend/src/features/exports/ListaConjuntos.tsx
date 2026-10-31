// Lista de conjuntos exportables agrupada por área.
//
// Es presentacional: recibe los conjuntos ya filtrados por permisos y avisa al
// contenedor qué conjunto y formato se eligió. Se usa tanto en la pantalla de
// exportaciones como en sus pruebas de estado vacío.
import type { Ref } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/EmptyState'
import type { FormatoExportacion } from '@/lib/api/exports'
import {
  AREAS_EXPORTACION,
  type ClaveConjuntoExport,
  type DefinicionConjuntoExport,
} from './catalogo'

interface ListaConjuntosProps {
  conjuntos: readonly DefinicionConjuntoExport[]
  generando: boolean
  preseleccionado: ClaveConjuntoExport | null
  onExportar: (
    definicion: DefinicionConjuntoExport,
    formato: FormatoExportacion,
  ) => void
  /** Ref al boton Excel del conjunto preseleccionado. */
  refPreseleccionado?: Ref<HTMLButtonElement>
}

export function ListaConjuntos({
  conjuntos,
  generando,
  preseleccionado,
  onExportar,
  refPreseleccionado,
}: ListaConjuntosProps) {
  if (conjuntos.length === 0) {
    return (
      <EmptyState
        title="Sin conjuntos disponibles"
        description="No tienes permiso de lectura para ningún conjunto exportable."
      />
    )
  }

  const grupos = AREAS_EXPORTACION.map((area) => ({
    area,
    conjuntos: conjuntos.filter(
      (definicion) => definicion.area === area.clave,
    ),
  })).filter((grupo) => grupo.conjuntos.length > 0)

  return (
    <div className="space-y-6">
      {grupos.map(({ area, conjuntos: delArea }) => (
        <section
          key={area.clave}
          aria-labelledby={`area-exportacion-${area.clave}`}
          className="space-y-2"
        >
          <h2
            id={`area-exportacion-${area.clave}`}
            className="text-sm font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {area.etiqueta}
          </h2>

          <Card className="gap-0 py-0">
            <ul className="divide-y divide-border">
              {delArea.map((definicion) => {
                const estaPreseleccionado =
                  preseleccionado === definicion.clave
                return (
                  <li
                    key={definicion.clave}
                    aria-current={
                      estaPreseleccionado ? 'true' : undefined
                    }
                    className={cn(
                      'flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between',
                      estaPreseleccionado && 'bg-accent/40',
                    )}
                  >
                    <div className="min-w-0 space-y-1">
                      <h3 className="font-medium">{definicion.etiqueta}</h3>
                      <p className="text-sm text-muted-foreground">
                        {definicion.descripcion}
                      </p>
                    </div>

                    <div
                      role="group"
                      aria-label={`Acciones para ${definicion.etiqueta}`}
                      className="flex shrink-0 items-center gap-2"
                    >
                      <Button
                        ref={
                          estaPreseleccionado
                            ? refPreseleccionado
                            : undefined
                        }
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={generando}
                        aria-label={`Exportar ${definicion.etiqueta} a Excel`}
                        onClick={() => onExportar(definicion, 'xlsx')}
                      >
                        Excel
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={generando}
                        aria-label={`Exportar ${definicion.etiqueta} a CSV`}
                        onClick={() => onExportar(definicion, 'csv')}
                      >
                        CSV
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  )
}
