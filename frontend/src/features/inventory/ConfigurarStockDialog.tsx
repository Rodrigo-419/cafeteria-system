// Diálogo para dar de alta un insumo en una sucursal o ajustar su stock mínimo
// y estado (PUT, que hace upsert). En modo edición el insumo queda fijo; en
// modo alta se elige del catálogo global.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ETIQUETA_ESTADO_STOCK,
  ETIQUETA_PRESENTACION,
  formatearCantidad,
  validarCantidad,
} from './presentacion'
import { mensajeDeError } from './mensajes'
import { useConfigurarStock, useInsumosDisponibles } from './queries'
import type { EstadoStockInsumo, StockInsumoApi } from '@/types/api'

interface ConfigurarStockDialogProps {
  sucursalId: string
  stock?: StockInsumoApi | null
  onClose: () => void
}

export function ConfigurarStockDialog({
  sucursalId,
  stock,
  onClose,
}: ConfigurarStockDialogProps) {
  const esEdicion = stock != null
  const [insumoId, setInsumoId] = useState(stock?.insumoId ?? '')
  const [minimoTexto, setMinimoTexto] = useState(stock?.stockMinimo ?? '0')
  const [estado, setEstado] = useState<EstadoStockInsumo>(stock?.estado ?? 'activo')
  const [error, setError] = useState<string | null>(null)

  const insumos = useInsumosDisponibles()
  const configurar = useConfigurarStock()

  const resultado = validarCantidad(minimoTexto, { estrictoPositivo: false })
  const valido = insumoId !== '' && resultado.valida

  function guardar() {
    if (!valido || !resultado.valida) return
    setError(null)
    configurar.mutate(
      {
        sucursalId,
        insumoId,
        entrada: { stockMinimo: resultado.valor, estado },
      },
      {
        onSuccess: () => {
          toast.success(
            esEdicion ? 'Stock configurado' : 'Insumo añadido a la sucursal',
          )
          onClose()
        },
        onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'configurar')),
      },
    )
  }

  const insumoSeleccionado = stock?.insumo

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? 'Configurar stock' : 'Añadir insumo a la sucursal'}
          </DialogTitle>
          <DialogDescription>
            {esEdicion
              ? 'Ajusta el stock mínimo y el estado del insumo en esta sucursal.'
              : 'Al darlo de alta, el insumo empieza con stock 0.'}
          </DialogDescription>
        </DialogHeader>
        <form
          id="form-stock"
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            guardar()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="stock-insumo">Insumo</Label>
            {esEdicion && insumoSeleccionado ? (
              <Input
                id="stock-insumo"
                value={`${insumoSeleccionado.nombre} (${ETIQUETA_PRESENTACION[insumoSeleccionado.presentacion]})`}
                readOnly
              />
            ) : (
              <Select value={insumoId} onValueChange={setInsumoId}>
                <SelectTrigger id="stock-insumo">
                  <SelectValue placeholder="Selecciona un insumo" />
                </SelectTrigger>
                <SelectContent>
                  {(insumos.data?.data ?? []).map((insumo) => (
                    <SelectItem key={insumo.id} value={insumo.id}>
                      {insumo.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {esEdicion && stock && (
            <p className="text-sm text-muted-foreground">
              Stock actual: {formatearCantidad(stock.stockActual)}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="stock-minimo">Stock mínimo</Label>
            <Input
              id="stock-minimo"
              value={minimoTexto}
              inputMode="decimal"
              onChange={(evento) => setMinimoTexto(evento.target.value)}
            />
            {!resultado.valida && (
              <p className="text-sm text-destructive">{resultado.mensaje}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock-estado">Estado</Label>
            <Select
              value={estado}
              onValueChange={(valor) => setEstado(valor as EstadoStockInsumo)}
            >
              <SelectTrigger id="stock-estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activo">
                  {ETIQUETA_ESTADO_STOCK.activo}
                </SelectItem>
                <SelectItem value="descontinuado">
                  {ETIQUETA_ESTADO_STOCK.descontinuado}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo guardar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={configurar.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-stock"
            disabled={configurar.isPending || !valido}
          >
            {configurar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
