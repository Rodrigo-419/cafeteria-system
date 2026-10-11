import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { BanIcon } from 'lucide-react'
import { mensajeDeError } from './mensajes'
import { useAnularVenta } from './queries'
import type { VentaApi } from '@/types/api'

const MAX_MOTIVO = 200

/**
 * Botón + ConfirmDialog para anular una venta.
 *
 * El backend decide si la anulación procede; la interfaz solo exige un motivo
 * de 1 a 200 caracteres (recortado) y muestra el 403/409 con su mensaje.
 */
export function AnnulSaleDialog({ venta }: { venta: VentaApi }) {
  const [open, setOpen] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const anular = useAnularVenta()

  const limpio = motivo.trim()
  const valido = limpio.length >= 1 && limpio.length <= MAX_MOTIVO

  function cerrar(abierto: boolean) {
    setOpen(abierto)
    if (!abierto) {
      setMotivo('')
      setError(null)
    }
  }

  function confirmar() {
    setError(null)
    anular.mutate(
      { id: venta.id, motivo: limpio },
      {
        onSuccess: () => {
          setMotivo('')
          setOpen(false)
        },
        onError: (fallo) => setError(mensajeDeError(fallo, 'anular')),
      },
    )
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <BanIcon className="size-4" />
        Anular
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={cerrar}
        title="Anular venta"
        description="La venta quedará registrada como anulada con el motivo indicado."
        confirmText="Anular venta"
        destructive
        loading={anular.isPending}
        confirmDisabled={!valido}
        onConfirm={confirmar}
      >
        <div className="space-y-2">
          <Label htmlFor={`motivo-${venta.id}`}>Motivo de la anulación</Label>
          <Textarea
            id={`motivo-${venta.id}`}
            value={motivo}
            maxLength={MAX_MOTIVO}
            placeholder="Explica brevemente por qué se anula la venta…"
            onChange={(evento) => setMotivo(evento.target.value)}
          />
          <p className="text-right text-xs text-muted-foreground">
            {motivo.length}/{MAX_MOTIVO}
          </p>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo anular</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </ConfirmDialog>
    </>
  )
}
