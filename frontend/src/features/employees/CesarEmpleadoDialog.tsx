// Diálogo de cese de un empleado. El cese no borra: deja al empleado `inactivo`
// con su histórico y bloquea la cuenta de usuario vinculada en la misma
// operación. Por eso se advierte con claridad antes de confirmar.
import { useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { diaDeNegocioLima } from '@/lib/format/dates'
import { mensajeDeError } from './mensajes'
import { mensajeFechaCese } from './presentacion'
import { useCesarEmpleado } from './queries'
import type { EmpleadoApi } from '@/types/api'

interface CesarEmpleadoDialogProps {
  empleado: EmpleadoApi
  onClose: () => void
}

export function CesarEmpleadoDialog({
  empleado,
  onClose,
}: CesarEmpleadoDialogProps) {
  const [fechaCese, setFechaCese] = useState(diaDeNegocioLima(new Date()))
  const [error, setError] = useState<string | null>(null)
  const cesar = useCesarEmpleado()

  const problemaFecha = mensajeFechaCese(empleado.fechaContratacion, fechaCese)

  function confirmar() {
    if (problemaFecha) return
    setError(null)
    cesar.mutate(
      {
        id: empleado.id,
        entrada: fechaCese === '' ? {} : { fechaCese },
      },
      {
        onSuccess: () => {
          toast.success('Empleado cesado')
          onClose()
        },
        onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'cesar')),
      },
    )
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(abierto) => !abierto && onClose()}
      title="Cesar empleado"
      description={`Se cesará a ${empleado.usuario.nombre}. Esta acción también bloquea su cuenta de usuario y no se puede deshacer desde aquí.`}
      destructive
      confirmText="Cesar empleado"
      loading={cesar.isPending}
      confirmDisabled={problemaFecha !== null}
      onConfirm={confirmar}
      onCancel={onClose}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="empleado-fecha-cese">Fecha de cese</Label>
          <Input
            id="empleado-fecha-cese"
            type="date"
            value={fechaCese}
            onChange={(evento) => setFechaCese(evento.target.value)}
          />
          {problemaFecha && (
            <p className="text-xs text-destructive">{problemaFecha}</p>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>No se pudo cesar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </ConfirmDialog>
  )
}
