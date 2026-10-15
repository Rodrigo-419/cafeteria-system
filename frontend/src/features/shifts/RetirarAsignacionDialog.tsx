// Diálogo para retirar (cerrar) una asignación de turno. No hay DELETE: retirar
// fija la fecha de fin. La fecha no puede ser anterior al inicio de la
// asignación ni a hoy en el calendario del negocio.
import { useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { diaDeNegocioLima } from '@/lib/format/dates'
import { mensajeDeError } from './mensajes'
import { formatearVigencia, mensajeFechaRetiro } from './presentacion'
import { useRetirarAsignacion } from './queries'
import type { AsignacionApi } from '@/types/api'

interface RetirarAsignacionDialogProps {
  asignacion: AsignacionApi
  onClose: () => void
}

export function RetirarAsignacionDialog({
  asignacion,
  onClose,
}: RetirarAsignacionDialogProps) {
  const hoy = diaDeNegocioLima(new Date())
  const [fechaFin, setFechaFin] = useState(hoy)
  const [error, setError] = useState<string | null>(null)
  const retirar = useRetirarAsignacion()

  const problemaFecha = mensajeFechaRetiro(asignacion.fechaInicio, hoy, fechaFin)

  function confirmar() {
    if (problemaFecha) return
    setError(null)
    retirar.mutate(
      { id: asignacion.id, fechaFin },
      {
        onSuccess: () => {
          toast.success('Asignación retirada')
          onClose()
        },
        onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'retirar')),
      },
    )
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(abierto) => !abierto && onClose()}
      title="Retirar asignación"
      description={`Se cerrará la asignación de ${asignacion.empleado.usuario.nombre} (${formatearVigencia(asignacion.fechaInicio, asignacion.fechaFin)}). La asignación no se borra: queda con su histórico.`}
      destructive
      confirmText="Retirar asignación"
      loading={retirar.isPending}
      confirmDisabled={problemaFecha !== null}
      onConfirm={confirmar}
      onCancel={onClose}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="asignacion-fecha-fin">Fecha de fin</Label>
          <Input
            id="asignacion-fecha-fin"
            type="date"
            value={fechaFin}
            onChange={(evento) => setFechaFin(evento.target.value)}
          />
          {problemaFecha && (
            <p className="text-xs text-destructive">{problemaFecha}</p>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>No se pudo retirar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </ConfirmDialog>
  )
}
