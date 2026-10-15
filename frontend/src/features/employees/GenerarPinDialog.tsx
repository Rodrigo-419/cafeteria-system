// Diálogo para generar el PIN de marcación de un empleado.
//
// El PIN en claro solo se muestra una vez: vive en el estado de este diálogo y
// se descarta al cerrarlo (no se cachea ni se guarda en el navegador). La API no
// expone si el empleado ya tenía PIN, así que se avisa en general de que generar
// uno nuevo invalida el anterior.
import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { PasswordReveal } from '@/components/shared/PasswordReveal'
import { mensajeDeError } from './mensajes'
import { useRegenerarPinEmpleado } from './queries'
import type { EmpleadoApi } from '@/types/api'

interface GenerarPinDialogProps {
  empleado: EmpleadoApi
  onClose: () => void
}

export function GenerarPinDialog({
  empleado,
  onClose,
}: GenerarPinDialogProps) {
  const [pin, setPin] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const regenerar = useRegenerarPinEmpleado()

  function confirmar() {
    setError(null)
    regenerar.mutate(empleado.id, {
      onSuccess: (respuesta) => setPin(respuesta.pin),
      onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'pin')),
    })
  }

  if (pin !== null) {
    return (
      <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PIN de marcación generado</DialogTitle>
            <DialogDescription>
              PIN de {empleado.usuario.nombre}. Compártelo con la persona: se
              usará para marcar su asistencia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="empleado-pin">PIN</Label>
              <PasswordReveal
                id="empleado-pin"
                valor={pin}
                etiquetaCopiar="Copiar PIN"
              />
            </div>
            <Alert>
              <AlertTitle>Se muestra una sola vez</AlertTitle>
              <AlertDescription>
                Anota o copia el PIN ahora. Si cierras esta ventana no podrás
                volver a verlo; tendrás que generar uno nuevo.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button onClick={onClose}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(abierto) => !abierto && onClose()}
      title="Generar PIN de marcación"
      description={`Se generará un PIN nuevo para ${empleado.usuario.nombre}. Si ya tenía uno, dejará de funcionar.`}
      confirmText="Generar PIN"
      loading={regenerar.isPending}
      onConfirm={confirmar}
      onCancel={onClose}
    >
      {error && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo generar el PIN</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </ConfirmDialog>
  )
}
