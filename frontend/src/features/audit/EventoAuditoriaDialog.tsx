// Detalle de un evento de auditoría en un diálogo.
//
// Muestra el "qué" legible (acción sobre entidad), el autor, la fecha en la
// zona de negocio y el resumen antes → después. La pantalla es de solo lectura:
// no hay acciones posibles sobre un evento.
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatearFechaHora } from '@/lib/format/dates'
import { etiquetaAccion, etiquetaEntidad } from '@/lib/auditoria/etiquetas'
import { DetalleResumen } from './DetalleResumen'
import type { EventoAuditoriaApi } from '@/types/api'

interface EventoAuditoriaDialogProps {
  evento: EventoAuditoriaApi
  onClose: () => void
}

export function EventoAuditoriaDialog({
  evento,
  onClose,
}: EventoAuditoriaDialogProps) {
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{etiquetaAccion(evento.accion)}</DialogTitle>
          <DialogDescription>
            {etiquetaEntidad(evento.entidad)} · {evento.actor.nombre} ·{' '}
            {formatearFechaHora(evento.fecha)}
          </DialogDescription>
        </DialogHeader>

        <DetalleResumen detalle={evento.detalle} />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
