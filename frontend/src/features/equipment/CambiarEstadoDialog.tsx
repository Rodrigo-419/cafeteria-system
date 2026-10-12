// Diálogo de cambio de estado de un equipo. Un equipo retirado es terminal y no
// llega aquí (la pantalla no ofrece la acción). El cambio de estado y las
// observaciones comparten un mismo PATCH y quedan registrados en el historial.
import { useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { mensajeDeError } from './mensajes'
import {
  ESTADOS_EQUIPO,
  ETIQUETA_ESTADO_EQUIPO,
  LARGO_OBSERVACIONES_EQUIPO,
  estadosDisponibles,
} from './presentacion'
import { useActualizarEquipo } from './queries'
import type { EquipoApi, EstadoEquipo } from '@/types/api'

interface CambiarEstadoDialogProps {
  equipo: EquipoApi
  onClose: () => void
}

export function CambiarEstadoDialog({
  equipo,
  onClose,
}: CambiarEstadoDialogProps) {
  const opciones = estadosDisponibles(equipo.estado)
  const [estadoNuevo, setEstadoNuevo] = useState<EstadoEquipo>(
    opciones[0] ?? equipo.estado,
  )
  const [observaciones, setObservaciones] = useState(equipo.observaciones ?? '')
  const [error, setError] = useState<string | null>(null)
  const actualizar = useActualizarEquipo()

  const observacionesLimpias = observaciones.trim()
  const observacionesValidas =
    observacionesLimpias.length <= LARGO_OBSERVACIONES_EQUIPO

  function confirmar() {
    if (!observacionesValidas) return
    setError(null)
    actualizar.mutate(
      {
        id: equipo.id,
        entrada: {
          estado: estadoNuevo,
          observaciones:
            observacionesLimpias === '' ? null : observacionesLimpias,
        },
      },
      {
        onSuccess: () => {
          toast.success('Estado del equipo actualizado')
          onClose()
        },
        onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'estado')),
      },
    )
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(abierto) => !abierto && onClose()}
      title="Cambiar estado"
      description={`Actualiza el estado de "${equipo.nombre}". El cambio quedará registrado en el historial.`}
      confirmText="Confirmar cambio"
      loading={actualizar.isPending}
      confirmDisabled={!observacionesValidas}
      onConfirm={confirmar}
      onCancel={onClose}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="estado-equipo-nuevo">Nuevo estado</Label>
          <Select
            value={estadoNuevo}
            onValueChange={(valor) => setEstadoNuevo(valor as EstadoEquipo)}
          >
            <SelectTrigger id="estado-equipo-nuevo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opciones.map((estado) => (
                <SelectItem key={estado} value={estado}>
                  {ETIQUETA_ESTADO_EQUIPO[estado]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Estado actual: {ETIQUETA_ESTADO_EQUIPO[equipo.estado]}. Puedes elegir
            cualquiera de los {ESTADOS_EQUIPO.length - 1} estados restantes.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="estado-equipo-observaciones">
            Observaciones (opcional)
          </Label>
          <Textarea
            id="estado-equipo-observaciones"
            value={observaciones}
            maxLength={LARGO_OBSERVACIONES_EQUIPO}
            onChange={(evento) => setObservaciones(evento.target.value)}
          />
          <p className="text-right text-xs text-muted-foreground">
            {observaciones.length}/{LARGO_OBSERVACIONES_EQUIPO}
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>No se pudo cambiar el estado</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </ConfirmDialog>
  )
}
