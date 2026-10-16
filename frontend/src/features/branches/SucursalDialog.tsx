// Diálogo de alta y edición de sucursales. Se monta solo cuando está abierto,
// de modo que su estado interno se descarta al cerrar.
//
// El backend exige `nombre` y `direccion` no vacíos (trim) y trata `telefono`
// como opcional: una cadena vacía se envía como `null` para limpiarlo. El
// nombre debe ser único ignorando mayúsculas y espacios (409 si se repite).
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
import type { SucursalApi } from '@/types/api'
import { mensajeDeError } from './mensajes'
import {
  useActualizarSucursal,
  useCrearSucursal,
} from './queries'

interface SucursalDialogProps {
  /** `null` para crear; la sucursal existente para editar. */
  sucursal?: SucursalApi | null
  onClose: () => void
}

export function SucursalDialog({ sucursal, onClose }: SucursalDialogProps) {
  const esCreacion = sucursal == null

  const [nombre, setNombre] = useState(sucursal?.nombre ?? '')
  const [direccion, setDireccion] = useState(sucursal?.direccion ?? '')
  const [telefono, setTelefono] = useState(sucursal?.telefono ?? '')
  const [error, setError] = useState<string | null>(null)

  const crear = useCrearSucursal()
  const actualizar = useActualizarSucursal()
  const pendiente = crear.isPending || actualizar.isPending

  const nombreValido = nombre.trim().length >= 2
  const direccionValida = direccion.trim().length >= 1
  const valido = nombreValido && direccionValida

  function guardar() {
    if (!valido) return
    setError(null)
    const telefonoFinal = telefono.trim() === '' ? null : telefono.trim()

    if (esCreacion) {
      crear.mutate(
        {
          nombre: nombre.trim(),
          direccion: direccion.trim(),
          telefono: telefonoFinal,
        },
        {
          onSuccess: () => {
            toast.success('Sucursal creada')
            onClose()
          },
          onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'crear')),
        },
      )
      return
    }

    if (!sucursal) return
    actualizar.mutate(
      {
        id: sucursal.id,
        entrada: {
          nombre: nombre.trim(),
          direccion: direccion.trim(),
          telefono: telefonoFinal,
        },
      },
      {
        onSuccess: () => {
          toast.success('Sucursal actualizada')
          onClose()
        },
        onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'editar')),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {esCreacion ? 'Crear sucursal' : 'Editar sucursal'}
          </DialogTitle>
          <DialogDescription>
            {esCreacion
              ? 'Registra el nombre, la dirección y el teléfono (opcional) de la nueva sucursal.'
              : 'Actualiza los datos de la sucursal. El nombre debe ser único.'}
          </DialogDescription>
        </DialogHeader>
        <form
          id="form-sucursal"
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            guardar()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="sucursal-nombre">Nombre</Label>
            <Input
              id="sucursal-nombre"
              value={nombre}
              maxLength={100}
              placeholder="Nombre de la sucursal"
              onChange={(evento) => setNombre(evento.target.value)}
            />
            {!nombreValido && nombre.length > 0 && (
              <p className="text-xs text-destructive">
                Ingresa al menos 2 caracteres.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sucursal-direccion">Dirección</Label>
            <Input
              id="sucursal-direccion"
              value={direccion}
              maxLength={200}
              placeholder="Dirección completa"
              onChange={(evento) => setDireccion(evento.target.value)}
            />
            {!direccionValida && direccion.length > 0 && (
              <p className="text-xs text-destructive">
                Ingresa una dirección.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sucursal-telefono">
              Teléfono (opcional)
            </Label>
            <Input
              id="sucursal-telefono"
              value={telefono}
              maxLength={30}
              placeholder="Ej. 999999999"
              onChange={(evento) => setTelefono(evento.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Déjalo vacío si no hay teléfono.
            </p>
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
          <Button
            type="submit"
            form="form-sucursal"
            disabled={!valido || pendiente}
          >
            {pendiente
              ? 'Guardando…'
              : esCreacion
                ? 'Crear sucursal'
                : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
