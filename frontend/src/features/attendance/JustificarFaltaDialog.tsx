// Diálogo para justificar una falta (G3).
//
// El backend elimina la falta del listado en cuanto queda justificada; aquí solo
// se pide el motivo. Requiere `asistencia.corregir`.
import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatearDiaLocal } from '@/lib/format/dates'
import { mensajeDeError } from '@/features/attendance/mensajes'
import { useJustificarFalta } from '@/features/attendance/queries'
import type { FaltaApi } from '@/types/api'

interface JustificarFaltaDialogProps {
  falta: FaltaApi
  onClose: () => void
}

export function JustificarFaltaDialog({
  falta,
  onClose,
}: JustificarFaltaDialogProps) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const justificar = useJustificarFalta()

  const motivoRecortado = motivo.trim()
  const problemaMotivo =
    motivoRecortado === ''
      ? 'El motivo es obligatorio.'
      : motivoRecortado.length > 200
        ? 'El motivo no puede superar 200 caracteres.'
        : null
  const valido = problemaMotivo === null

  function guardar() {
    if (!valido) return
    setError(null)
    justificar.mutate(
      { empleadoId: falta.empleadoId, fecha: falta.fecha, motivo: motivoRecortado },
      {
        onSuccess: () => onClose(),
        onError: (fallo: unknown) =>
          setError(mensajeDeError(fallo, 'justificar')),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Justificar falta</DialogTitle>
          <DialogDescription>
            {falta.empleadoNombre} · {formatearDiaLocal(falta.fecha)}. Indica el
            motivo de la justificación.
          </DialogDescription>
        </DialogHeader>
        <form
          id="form-justificar"
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            guardar()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="justificar-motivo">Motivo</Label>
            <Textarea
              id="justificar-motivo"
              rows={3}
              maxLength={200}
              placeholder="Ej.: permiso médico presentado al gerente."
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
            />
            {motivoRecortado === '' && (
              <p className="text-xs text-destructive">
                El motivo es obligatorio.
              </p>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={justificar.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-justificar"
            disabled={!valido || justificar.isPending}
          >
            Justificar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
