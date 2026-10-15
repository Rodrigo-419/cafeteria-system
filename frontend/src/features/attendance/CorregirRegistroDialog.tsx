// Diálogo para corregir un registro de asistencia (G2).
//
// El backend corrige un registro EFECTIVO existente (su id): inserta una fila
// nueva que apunta a la original, por eso aquí no se elige colaborador (la
// diferencia con el diseño). Se fija la hora correcta, se puede cambiar el tipo
// y es obligatorio un motivo. Solo Gerentes con `asistencia.corregir` llegan
// aquí; el backend valida además que nadie corrija sus propios registros.
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { aInputDatetimeLocal } from '@/lib/format/dates'
import { mensajeDeError } from '@/features/attendance/mensajes'
import {
  etiquetaTipo,
  TIPOS_MARCAJE,
} from '@/features/attendance/presentacion'
import { useCorregirRegistro } from '@/features/attendance/queries'
import type { RegistroAsistenciaApi, TipoMarcaje } from '@/types/api'

interface CorregirRegistroDialogProps {
  registro: RegistroAsistenciaApi
  onClose: () => void
}

export function CorregirRegistroDialog({
  registro,
  onClose,
}: CorregirRegistroDialogProps) {
  const tipoInicial: TipoMarcaje = registro.tipo === 'salida' ? 'salida' : 'entrada'
  const [tipo, setTipo] = useState<TipoMarcaje>(tipoInicial)
  const [fechaHora, setFechaHora] = useState(
    aInputDatetimeLocal(registro.fechaHora),
  )
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)

  const corregir = useCorregirRegistro()

  const motivoRecortado = motivo.trim()
  const problemaMotivo =
    motivoRecortado === ''
      ? 'El motivo es obligatorio.'
      : motivoRecortado.length > 200
        ? 'El motivo no puede superar 200 caracteres.'
        : null
  const problemaFecha =
    fechaHora === '' ? 'La fecha y hora correctas son obligatorias.' : null
  const valido = problemaMotivo === null && problemaFecha === null

  function guardar() {
    if (!valido) return
    setError(null)
    corregir.mutate(
      {
        id: registro.id,
        entrada: {
          motivo: motivoRecortado,
          fechaHora: new Date(fechaHora).toISOString(),
          tipo,
        },
      },
      {
        onSuccess: () => onClose(),
        onError: (fallo: unknown) =>
          setError(mensajeDeError(fallo, 'corregir')),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corregir registro</DialogTitle>
          <DialogDescription>
            Se registra una corrección inmutable de {registro.empleado.nombre}.
            Indica la hora correcta y el motivo.
          </DialogDescription>
        </DialogHeader>
        <form
          id="form-correccion"
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            guardar()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="correccion-tipo">Tipo de evento</Label>
            <Select
              value={tipo}
              onValueChange={(valor) => setTipo(valor as TipoMarcaje)}
            >
              <SelectTrigger id="correccion-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_MARCAJE.map((opcion) => (
                  <SelectItem key={opcion} value={opcion}>
                    {etiquetaTipo(opcion)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="correccion-fecha">Fecha y hora correctas</Label>
            <Input
              id="correccion-fecha"
              type="datetime-local"
              value={fechaHora}
              onChange={(evento) => setFechaHora(evento.target.value)}
            />
            {fechaHora === '' && (
              <p className="text-xs text-destructive">
                La fecha y hora son obligatorias.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="correccion-motivo">Motivo</Label>
            <Textarea
              id="correccion-motivo"
              rows={3}
              maxLength={200}
              placeholder="Ej.: olvidó registrar la entrada por un corte de energía."
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
            />
            {motivo.trim() === '' && (
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
            disabled={corregir.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-correccion"
            disabled={!valido || corregir.isPending}
          >
            Guardar corrección
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
