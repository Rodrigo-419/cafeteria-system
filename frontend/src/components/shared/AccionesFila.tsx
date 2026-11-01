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
  /** Las acciones destructivas se marcan visualmente; en el menú se pintan en rojo. */
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
  /**
   * Resto de acciones. Si solo hay una y tiene icono, se muestra como botón
   * directo; en cualquier otro caso van dentro del menú "⋯".
   */
  acciones?: readonly AccionFila[]
  etiquetaMenu?: string
}

/**
 * Acciones de una fila de listado: una acción principal visible y el resto en
 * un menú "⋯". Una única acción secundaria con icono se muestra como botón
 * directo para evitar un clic innecesario. Las acciones destructivas pueden
 * confirmarse aquí o en el diálogo controlado por el consumidor.
 */
export function AccionesFila({
  principal,
  acciones = [],
  etiquetaMenu = 'Más acciones',
}: AccionesFilaProps) {
  const [pendiente, setPendiente] = useState<AccionFila | null>(null)

  if (!principal && acciones.length === 0) return null

  const accionUnica = acciones.length === 1 ? acciones[0] : undefined
  const accionDirecta =
    accionUnica?.icono != null ? accionUnica : undefined

  function ejecutar(accion: AccionFila) {
    if (accion.confirmacion) {
      setPendiente(accion)
      return
    }
    accion.onSelect()
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {principal}
      {accionDirecta ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={accionDirecta.etiqueta}
          title={accionDirecta.etiqueta}
          disabled={accionDirecta.deshabilitada}
          className={
            accionDirecta.destructiva
              ? 'text-muted-foreground hover:text-destructive focus-visible:text-destructive'
              : undefined
          }
          onClick={() => ejecutar(accionDirecta)}
        >
          {accionDirecta.icono}
        </Button>
      ) : (
        acciones.length > 0 && (
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
                  onSelect={() => ejecutar(accion)}
                >
                  {accion.icono}
                  {accion.etiqueta}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      )}
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
    </div>
  )
}
