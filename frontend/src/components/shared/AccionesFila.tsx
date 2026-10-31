import { useState, type ReactNode } from 'react'
import { MoreHorizontalIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from './ConfirmDialog'

export interface ConfirmacionAccion {
  titulo: string
  descripcion?: string
  textoConfirmar?: string
  textoCancelar?: string
}

export interface AccionFila {
  etiqueta: string
  onSelect: () => void
  icono?: ReactNode
  /** Las acciones destructivas SIEMPRE se pintan dentro del menú "⋯". */
  destructiva?: boolean
  deshabilitada?: boolean
  titulo?: string
  /**
   * Confirmación integrada para acciones que no necesitan contenido extra.
   * Si la acción requiere un motivo u otro formulario, el consumidor abre su
   * propio diálogo de confirmación desde `onSelect`.
   */
  confirmacion?: ConfirmacionAccion
}

export interface AccionesFilaProps {
  /** Acción principal visible (botón o enlace). */
  principal?: ReactNode
  /** Resto de acciones, siempre dentro del menú "⋯". */
  acciones?: readonly AccionFila[]
  etiquetaMenu?: string
}

/**
 * Acciones de una fila de listado: una acción principal visible y el resto en
 * un menú "⋯". Las acciones destructivas nunca se pintan fuera del menú y
 * pueden confirmarse aquí o en el diálogo controlado por el consumidor.
 */
export function AccionesFila({
  principal,
  acciones = [],
  etiquetaMenu = 'Más acciones',
}: AccionesFilaProps) {
  const [pendiente, setPendiente] = useState<AccionFila | null>(null)

  if (!principal && acciones.length === 0) return null

  return (
    <div className="flex items-center justify-end gap-1">
      {principal}
      {acciones.length > 0 && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={etiquetaMenu}
              >
                <MoreHorizontalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {acciones.map((accion) => (
                <DropdownMenuItem
                  key={accion.etiqueta}
                  variant={accion.destructiva ? 'destructive' : 'default'}
                  disabled={accion.deshabilitada}
                  title={accion.titulo}
                  onSelect={() => {
                    if (accion.confirmacion) {
                      setPendiente(accion)
                      return
                    }
                    accion.onSelect()
                  }}
                >
                  {accion.icono}
                  {accion.etiqueta}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {pendiente?.confirmacion && (
            <ConfirmDialog
              open
              onOpenChange={(abierto) => {
                if (!abierto) setPendiente(null)
              }}
              title={pendiente.confirmacion.titulo}
              description={pendiente.confirmacion.descripcion}
              confirmText={pendiente.confirmacion.textoConfirmar}
              cancelText={pendiente.confirmacion.textoCancelar}
              destructive={pendiente.destructiva}
              onConfirm={() => {
                pendiente.onSelect()
                setPendiente(null)
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
