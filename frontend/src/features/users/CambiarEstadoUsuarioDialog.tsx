// Diálogo de bloqueo/activación de un usuario con confirmación.
//
// Bloquear impide iniciar sesión hasta que se reactive; el backend responde 400
// si es la propia cuenta y 409 si sería el último administrador activo — en
// ambos casos se muestra el mensaje del servidor y el diálogo continúa abierto.
import { useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { mensajeDeError } from './mensajes'
import { useCambiarEstadoUsuario } from './queries'
import type { UsuarioGestionApi } from '@/types/api'

interface CambiarEstadoUsuarioDialogProps {
  usuario: UsuarioGestionApi
  onClose: () => void
}

export function CambiarEstadoUsuarioDialog({
  usuario,
  onClose,
}: CambiarEstadoUsuarioDialogProps) {
  const bloqueando = usuario.estado === 'activo'
  const cambiar = useCambiarEstadoUsuario()
  const [error, setError] = useState<string | null>(null)

  function confirmar() {
    setError(null)
    cambiar.mutate(
      { id: usuario.id, estado: bloqueando ? 'bloqueado' : 'activo' },
      {
        onSuccess: () => {
          toast.success(bloqueando ? 'Usuario bloqueado' : 'Usuario activado')
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
      title={bloqueando ? 'Bloquear usuario' : 'Activar usuario'}
      description={
        bloqueando
          ? `Al bloquear a "${usuario.nombre}" dejará de poder iniciar sesión. Podrás reactivarlo cuando quieras.`
          : `"${usuario.nombre}" podrá volver a iniciar sesión.`
      }
      confirmText={bloqueando ? 'Bloquear' : 'Activar'}
      destructive={bloqueando}
      loading={cambiar.isPending}
      onConfirm={confirmar}
      onCancel={onClose}
    >
      {error && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo cambiar el estado</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </ConfirmDialog>
  )
}