// Diálogo de alta y edición de un insumo del catálogo global. Se monta solo
// cuando está abierto, de modo que su estado interno se reinicia en cada
// apertura.
//
// La validación aquí es una ayuda: el backend sigue siendo la autoridad y sus
// errores (400/409) se muestran tal cual con `mensajeDeError`.
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
  ETIQUETA_PRESENTACION,
  LARGO_NOMBRE_INSUMO,
  PRESENTACIONES_INSUMO,
  mensajeNombre,
} from './presentacion'
import { mensajeDeError } from './mensajes'
import { useActualizarInsumo, useCrearInsumo } from './queries'
import type { InsumoApi, PresentacionInsumo } from '@/types/api'

interface InsumoDialogProps {
  insumo?: InsumoApi | null
  onClose: () => void
}

export function InsumoDialog({ insumo, onClose }: InsumoDialogProps) {
  const esEdicion = insumo != null
  const [nombre, setNombre] = useState(insumo?.nombre ?? '')
  const [presentacion, setPresentacion] = useState<PresentacionInsumo>(
    insumo?.presentacion ?? 'unidad',
  )
  const [error, setError] = useState<string | null>(null)

  const crear = useCrearInsumo()
  const actualizar = useActualizarInsumo()
  const pendiente = crear.isPending || actualizar.isPending
  const valido = mensajeNombre(nombre) === null

  function guardar() {
    if (!valido) return
    setError(null)
    const entrada = { nombre: nombre.trim(), presentacion }
    const opciones = {
      onSuccess: () => {
        toast.success(esEdicion ? 'Insumo actualizado' : 'Insumo creado')
        onClose()
      },
      onError: (fallo: unknown) =>
        setError(mensajeDeError(fallo, esEdicion ? 'editar' : 'crear')),
    }
    if (esEdicion && insumo) {
      actualizar.mutate({ id: insumo.id, entrada }, opciones)
    } else {
      crear.mutate(entrada, opciones)
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{esEdicion ? 'Editar insumo' : 'Nuevo insumo'}</DialogTitle>
          <DialogDescription>
            El insumo pertenece al catálogo global. Su stock se gestiona por
            sucursal en la pantalla de inventario.
          </DialogDescription>
        </DialogHeader>
        <form
          id="form-insumo"
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            guardar()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="insumo-nombre">Nombre</Label>
            <Input
              id="insumo-nombre"
              value={nombre}
              maxLength={LARGO_NOMBRE_INSUMO.max}
              onChange={(evento) => setNombre(evento.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="insumo-presentacion">Presentación</Label>
            <Select
              value={presentacion}
              onValueChange={(valor) =>
                setPresentacion(valor as PresentacionInsumo)
              }
            >
              <SelectTrigger id="insumo-presentacion">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESENTACIONES_INSUMO.map((valor) => (
                  <SelectItem key={valor} value={valor}>
                    {ETIQUETA_PRESENTACION[valor]}
                  </SelectItem>
                ))}
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
          <Button variant="outline" onClick={onClose} disabled={pendiente}>
            Cancelar
          </Button>
          <Button type="submit" form="form-insumo" disabled={pendiente || !valido}>
            {pendiente
              ? 'Guardando…'
              : esEdicion
                ? 'Guardar cambios'
                : 'Crear insumo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
