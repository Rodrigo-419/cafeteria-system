// Diálogo para crear o actualizar el precio (oferta) de una variante en una
// sucursal. Un UpsertOfertaDto solo admite precio y estado: producto y variante
// forman parte de la ruta y no se editan después de creada la oferta.
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
import { useActualizarOferta, useProductos, useVariantes } from './queries'
import { mensajeDeError } from './mensajes'
import { ETIQUETA_OFERTA, PRECIO_MAXIMO, PRECIO_MINIMO, validarPrecio } from './presentacion'
import type { CartaOferta, EstadoOferta } from '@/types/api'

const LIMITE_SELECTOR = 100

interface OfertaDialogProps {
  sucursalId: string
  oferta?: CartaOferta | null
  onClose: () => void
}

export function OfertaDialog({
  sucursalId,
  oferta,
  onClose,
}: OfertaDialogProps) {
  const esEdicion = oferta != null
  const [productoId, setProductoId] = useState(oferta?.productoId ?? '')
  const [varianteId, setVarianteId] = useState(oferta?.varianteId ?? '')
  const [precioTexto, setPrecioTexto] = useState(oferta?.precio ?? '')
  const [estado, setEstado] = useState<EstadoOferta>(
    oferta?.estado ?? 'activo',
  )
  const [error, setError] = useState<string | null>(null)

  const productos = useProductos({ page: 1, limit: LIMITE_SELECTOR })
  const variantes = useVariantes()
  const guardar = useActualizarOferta()

  const resultado = validarPrecio(precioTexto)
  const valido =
    resultado.valido && productoId !== '' && varianteId !== ''

  function enviar() {
    if (!resultado.valido) return
    if (productoId === '' || varianteId === '') return
    setError(null)
    guardar.mutate(
      {
        sucursalId,
        productoId,
        varianteId,
        precio: resultado.valor,
        estado,
      },
      {
        onSuccess: () => {
          toast.success(esEdicion ? 'Precio actualizado' : 'Producto añadido a la carta')
          onClose()
        },
        onError: (fallo) => setError(mensajeDeError(fallo, 'precio')),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? 'Editar precio' : 'Añadir a la carta'}
          </DialogTitle>
          <DialogDescription>
            {esEdicion
              ? 'Actualiza el precio y el estado de esta variante en la sucursal.'
              : 'Fija el precio inicial de una variante de producto en la sucursal.'}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            enviar()
          }}
        >
          {esEdicion && oferta ? (
            <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{oferta.producto.nombre}</p>
              <p className="text-muted-foreground">
                {oferta.producto.categoria.nombre} · {oferta.variante.nombre}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="oferta-producto">Producto</Label>
                <Select value={productoId} onValueChange={setProductoId}>
                  <SelectTrigger id="oferta-producto">
                    <SelectValue placeholder="Selecciona un producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {(productos.data?.data ?? []).map((producto) => (
                      <SelectItem key={producto.id} value={producto.id}>
                        {producto.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="oferta-variante">Variante</Label>
                <Select value={varianteId} onValueChange={setVarianteId}>
                  <SelectTrigger id="oferta-variante">
                    <SelectValue placeholder="Selecciona una variante" />
                  </SelectTrigger>
                  <SelectContent>
                    {(variantes.data ?? []).map((variante) => (
                      <SelectItem key={variante.id} value={variante.id}>
                        {variante.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="oferta-precio">Precio (S/)</Label>
              <Input
                id="oferta-precio"
                inputMode="decimal"
                value={precioTexto}
                placeholder="0.00"
                onChange={(evento) => setPrecioTexto(evento.target.value)}
              />
              {precioTexto !== '' && !resultado.valido ? (
                <p className="text-xs text-destructive">{resultado.mensaje}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Entre {PRECIO_MINIMO} y {PRECIO_MAXIMO}.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="oferta-estado">Estado</Label>
              <Select
                value={estado}
                onValueChange={(valor) => setEstado(valor as EstadoOferta)}
              >
                <SelectTrigger id="oferta-estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">
                    {ETIQUETA_OFERTA.activo}
                  </SelectItem>
                  <SelectItem value="inactivo">
                    {ETIQUETA_OFERTA.inactivo}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo guardar el precio</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={guardar.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!valido || guardar.isPending}>
              {guardar.isPending
                ? 'Guardando…'
                : esEdicion
                  ? 'Guardar precio'
                  : 'Añadir'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
