// Campo de solo lectura para mostrar una contraseña temporal con botón de
// copiar. No persiste nada: el valor vive en el estado del padre y se descarta
// al desmontar el diálogo que lo muestra.
import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PasswordRevealProps {
  id: string
  valor: string
  /** Etiqueta accesible del botón de copiar. */
  etiquetaCopiar?: string
}

export function PasswordReveal({
  id,
  valor,
  etiquetaCopiar = 'Copiar contraseña',
}: PasswordRevealProps) {
  function copiar() {
    if (!navigator.clipboard?.writeText) {
      toast.error('No se pudo copiar en tu navegador.')
      return
    }
    void navigator.clipboard.writeText(valor).then(
      () => toast.success('Contraseña copiada'),
      () => toast.error('No se pudo copiar la contraseña.'),
    )
  }

  return (
    <div className="flex gap-2">
      <Input id={id} readOnly value={valor} className="font-mono" />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={copiar}
        aria-label={etiquetaCopiar}
      >
        <CopyIcon className="size-4" />
      </Button>
    </div>
  )
}