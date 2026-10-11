// Diálogo para registrar una entrada de stock de un insumo en una sucursal.
// En modo fila el insumo viene fijo; en modo cabecera se elige entre los insumos
// activos de la sucursal. Solo se envían los campos que soporta el backend
// (cantidad y motivo opcional); la respuesta trae la fila actualizada.
import { useState } from 'react'
import { toast } from 'sonner'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ETIQUETA_PRESENTACION,
  LARGO_MOTIVO_ENTRADA,
  formatearCantidad,
  validarCantidad,
} from './presentacion'
import { mensajeDeError } from './mensajes'
import { LIMITE_RESUMEN, useRegistrarEntrada, useStock } from './queries'
import type { StockInsumoApi } from '@/types/api'

interface EntradaDialogProps {
  sucursalId: string
  stock?: StockInsumoApi | null
  onClose: () => void
}

export function EntradaDialog({ sucursalId, stock, onClose }: EntradaDialogProps) {
  const [insumoId, setInsumoId] = useState(stock?.insumoId ?? '')
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)

  const disponibles = useStock(sucursalId, {
    page: 1,
    limit: LIMITE_RESUMEN,
  })
  const registrar = useRegistrarEntrada()

  const opciones = (disponibles.data?.data ?? []).filter(
    (fila) => fila.estado === 'activo',
  )
  const seleccionado: StockInsumoApi | undefined =
    stock ?? opciones.find((fila) => fila.insumoId === insumoId)
  const resultado = validarCantidad(cantidad, { estrictoPositivo: true })
  const valido = insumoId !== '' && resultado.valida

  function guardar() {
    if (!valido || !resultado.valida) return
    setError(null)
    const motivoLimpio = motivo.trim()
    registrar.mutate(
      {
        sucursalId,
        insumoId,
        entrada: {
          cantidad: resultado.valor,
          ...(motivoLimpio !== '' ? { motivo: motivoLimpio } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success('Entrada registrada')
          onClose()
        },
        onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'entrada')),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar entrada</DialogTitle>
          <DialogDescription>
            Suma stock al insumo en esta sucursal. El motivo es opcional.
          </DialogDescription>
        </DialogHeader>
        <form
          id="form-entrada"
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            guardar()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="entrada-insumo">Insumo</Label>
            {stock ? (
              <Input
                id="entrada-insumo"
                value={`${stock.insumo.nombre} (${ETIQUETA_PRESENTACION[stock.insumo.presentacion]})`}
                readOnly
              />
            ) : (
              <Select value={insumoId} onValueChange={setInsumoId}>
                <SelectTrigger id="entrada-insumo">
                  <SelectValue placeholder="Selecciona un insumo" />
                </SelectTrigger>
                <SelectContent>
                  {opciones.map((fila) => (
                    <SelectItem key={fila.insumoId} value={fila.insumoId}>
                      {fila.insumo.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {seleccionado && (
            <p className="text-sm text-muted-foreground">
              Presentación: {ETIQUETA_PRESENTACION[seleccionado.insumo.presentacion]} ·
              Stock actual: {formatearCantidad(seleccionado.stockActual)}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="entrada-cantidad">Cantidad recibida</Label>
            <Input
              id="entrada-cantidad"
              value={cantidad}
              inputMode="decimal"
              onChange={(evento) => setCantidad(evento.target.value)}
            />
            {!resultado.valida && (
              <p className="text-sm text-destructive">{resultado.mensaje}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="entrada-motivo">Motivo (opcional)</Label>
            <Textarea
              id="entrada-motivo"
              value={motivo}
              maxLength={LARGO_MOTIVO_ENTRADA}
              onChange={(evento) => setMotivo(evento.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground">
              {motivo.length}/{LARGO_MOTIVO_ENTRADA}
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo registrar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={registrar.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-entrada"
            disabled={registrar.isPending || !valido}
          >
            {registrar.isPending ? 'Registrando…' : 'Registrar entrada'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
