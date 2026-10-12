// Diálogo de alta y edición de equipos. Se monta solo cuando está abierto, de
// modo que su estado interno se reinicia en cada apertura.
//
// En el alta el Admin elige la sucursal destino; un Gerente crea siempre en la
// suya, así que no ve el selector (el backend además la impone). La edición no
// permite cambiar de sucursal: el contrato PATCH no expone `sucursalId`.
//
// La validación aquí es una ayuda: el backend sigue siendo la autoridad y sus
// errores (400/403/404) se muestran tal cual con `mensajeDeError`.
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
import { useAuth } from '@/lib/auth/useAuth'
import { mensajeDeError } from './mensajes'
import {
  LARGO_NOMBRE_EQUIPO,
  LARGO_OBSERVACIONES_EQUIPO,
  LARGO_TIPO_EQUIPO,
  mensajeTexto,
} from './presentacion'
import {
  useActualizarEquipo,
  useCrearEquipo,
  useSucursalesEquipos,
} from './queries'
import type { EquipoApi } from '@/types/api'

interface EquipoDialogProps {
  equipo?: EquipoApi | null
  onClose: () => void
}

export function EquipoDialog({ equipo, onClose }: EquipoDialogProps) {
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'Admin'
  const esEdicion = equipo != null

  const [nombre, setNombre] = useState(equipo?.nombre ?? '')
  const [tipo, setTipo] = useState(equipo?.tipo ?? '')
  const [observaciones, setObservaciones] = useState(equipo?.observaciones ?? '')
  const [sucursalId, setSucursalId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const sucursales = useSucursalesEquipos(esAdmin && !esEdicion)
  const crear = useCrearEquipo()
  const actualizar = useActualizarEquipo()
  const pendiente = crear.isPending || actualizar.isPending

  const observacionesLimpias = observaciones.trim()
  const nombreValido = mensajeTexto(nombre, 'El nombre', LARGO_NOMBRE_EQUIPO) === null
  const tipoValido = mensajeTexto(tipo, 'El tipo', LARGO_TIPO_EQUIPO) === null
  const observacionesValidas =
    observacionesLimpias.length <= LARGO_OBSERVACIONES_EQUIPO
  const sucursalValida = esEdicion || (esAdmin ? sucursalId !== '' : usuario?.sucursalId != null)
  const valido =
    nombreValido && tipoValido && observacionesValidas && sucursalValida

  function guardar() {
    if (!valido) return
    setError(null)
    const textoObservaciones =
      observacionesLimpias === '' ? null : observacionesLimpias

    if (esEdicion && equipo) {
      actualizar.mutate(
        {
          id: equipo.id,
          entrada: {
            nombre: nombre.trim(),
            tipo: tipo.trim(),
            observaciones: textoObservaciones,
          },
        },
        {
          onSuccess: () => {
            toast.success('Equipo actualizado')
            onClose()
          },
          onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'editar')),
        },
      )
      return
    }

    const destino = esAdmin ? sucursalId : usuario?.sucursalId
    if (!destino) return
    crear.mutate(
      {
        sucursalId: destino,
        nombre: nombre.trim(),
        tipo: tipo.trim(),
        observaciones: textoObservaciones,
      },
      {
        onSuccess: () => {
          toast.success('Equipo registrado')
          onClose()
        },
        onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'crear')),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? 'Editar equipo' : 'Registrar equipo'}
          </DialogTitle>
          <DialogDescription>
            {esEdicion
              ? 'Actualiza los datos del equipo. La sucursal no se puede cambiar.'
              : 'El equipo se registra en una sucursal de tu alcance.'}
          </DialogDescription>
        </DialogHeader>
        <form
          id="form-equipo"
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            guardar()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="equipo-nombre">Nombre</Label>
            <Input
              id="equipo-nombre"
              value={nombre}
              maxLength={LARGO_NOMBRE_EQUIPO.max}
              onChange={(evento) => setNombre(evento.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="equipo-tipo">Tipo</Label>
            <Input
              id="equipo-tipo"
              value={tipo}
              maxLength={LARGO_TIPO_EQUIPO.max}
              placeholder="cafetera, molino, refrigeradora…"
              onChange={(evento) => setTipo(evento.target.value)}
            />
          </div>

          {esAdmin && !esEdicion && (
            <div className="space-y-2">
              <Label htmlFor="equipo-sucursal">Sucursal</Label>
              <Select value={sucursalId} onValueChange={setSucursalId}>
                <SelectTrigger id="equipo-sucursal">
                  <SelectValue placeholder="Selecciona una sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {(sucursales.data ?? []).map((sucursal) => (
                    <SelectItem key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!esEdicion && !esAdmin && usuario?.sucursalId == null && (
            <Alert>
              <AlertTitle>Sin sucursal asignada</AlertTitle>
              <AlertDescription>
                Tu usuario no tiene una sucursal asignada, así que no puedes
                registrar equipos.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="equipo-observaciones">Observaciones (opcional)</Label>
            <Textarea
              id="equipo-observaciones"
              value={observaciones}
              maxLength={LARGO_OBSERVACIONES_EQUIPO}
              onChange={(evento) => setObservaciones(evento.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground">
              {observaciones.length}/{LARGO_OBSERVACIONES_EQUIPO}
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
          <Button type="submit" form="form-equipo" disabled={pendiente}>
            {pendiente ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Registrar equipo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
