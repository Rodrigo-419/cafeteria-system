// Diálogo de alta y edición de empleados. Se monta solo cuando está abierto, de
// modo que su estado interno se reinicia en cada apertura.
//
// El alta vincula un usuario EXISTENTE: el empleado hereda su sucursal, así que
// no se elige sucursal (el backend rechaza una distinta con 400). Solo se
// ofrecen usuarios con rol Empleado o Gerente; un Admin no puede ser empleado.
// La edición solo permite cambiar el cargo: el contrato PATCH no expone ningún
// otro campo.
//
// La validación aquí es una ayuda: el backend sigue siendo la autoridad y sus
// errores (400/403/404/409) se muestran tal cual con `mensajeDeError`.
import { useEffect, useMemo, useState } from 'react'
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
import { useAuth } from '@/lib/auth/useAuth'
import { diaDeNegocioLima, formatearDiaLocal } from '@/lib/format/dates'
import { tienePermiso } from '@/lib/permissions/permissions'
import { mensajeDeError } from './mensajes'
import {
  LARGO_CARGO,
  mensajeCargo,
  mensajeFechaContratacion,
} from './presentacion'
import {
  useActualizarCargoEmpleado,
  useCrearEmpleado,
  useEmpleadosVinculados,
  useSucursalesEmpleados,
  useUsuariosVinculables,
} from './queries'
import type { EmpleadoApi } from '@/types/api'

interface EmpleadoDialogProps {
  empleado?: EmpleadoApi | null
  onClose: () => void
}

export function EmpleadoDialog({ empleado, onClose }: EmpleadoDialogProps) {
  const { permisos } = useAuth()
  const puedeVerUsuarios = tienePermiso(permisos, 'usuarios.crear_editar')
  const esEdicion = empleado != null

  const [usuarioId, setUsuarioId] = useState('')
  const [textoUsuario, setTextoUsuario] = useState('')
  const [busquedaUsuario, setBusquedaUsuario] = useState('')
  const [cargo, setCargo] = useState(empleado?.cargo ?? '')
  const [fechaContratacion, setFechaContratacion] = useState(
    diaDeNegocioLima(new Date()),
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const temporizador = setTimeout(() => setBusquedaUsuario(textoUsuario), 300)
    return () => clearTimeout(temporizador)
  }, [textoUsuario])

  const usuarios = useUsuariosVinculables(
    busquedaUsuario,
    !esEdicion && puedeVerUsuarios,
  )
  const vinculados = useEmpleadosVinculados(!esEdicion)
  const sucursales = useSucursalesEmpleados(!esEdicion)
  const crear = useCrearEmpleado()
  const actualizar = useActualizarCargoEmpleado()
  const pendiente = crear.isPending || actualizar.isPending

  const opciones = useMemo(
    () =>
      (usuarios.data?.data ?? []).filter((usuario) => usuario.rol !== 'Admin'),
    [usuarios.data],
  )

  const usuarioSeleccionado = opciones.find((u) => u.id === usuarioId)
  const nombreSucursal = (sucursalId: string | null | undefined) =>
    sucursales.data?.find((s) => s.id === sucursalId)?.nombre ?? '—'

  const cargoValido = mensajeCargo(cargo) === null
  const fechaValida = mensajeFechaContratacion(fechaContratacion) === null
  const valido = esEdicion
    ? cargoValido
    : cargoValido && fechaValida && usuarioId !== ''

  function guardar() {
    if (!valido) return
    setError(null)

    if (esEdicion && empleado) {
      actualizar.mutate(
        { id: empleado.id, cargo: cargo.trim() },
        {
          onSuccess: () => {
            toast.success('Cargo actualizado')
            onClose()
          },
          onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'editar')),
        },
      )
      return
    }

    crear.mutate(
      {
        usuarioId,
        cargo: cargo.trim(),
        fechaContratacion,
      },
      {
        onSuccess: () => {
          toast.success('Empleado registrado')
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
            {esEdicion ? 'Editar empleado' : 'Registrar empleado'}
          </DialogTitle>
          <DialogDescription>
            {esEdicion
              ? 'Solo se puede cambiar el cargo. La fecha de contratación y el cese no se editan.'
              : 'El empleado se vincula a un usuario existente y hereda su sucursal.'}
          </DialogDescription>
        </DialogHeader>
        <form
          id="form-empleado"
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            guardar()
          }}
        >
          {esEdicion && empleado ? (
            <div className="space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">Usuario: </span>
                {empleado.usuario.nombre} (@{empleado.usuario.nombreUsuario})
              </div>
              <div>
                <span className="text-muted-foreground">Sucursal: </span>
                {nombreSucursal(empleado.sucursalId)}
              </div>
              <div>
                <span className="text-muted-foreground">
                  Fecha de contratación:{' '}
                </span>
                {formatearDiaLocal(empleado.fechaContratacion)}
              </div>
            </div>
          ) : (
            <>
              {puedeVerUsuarios ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="empleado-buscar-usuario">
                      Buscar usuario
                    </Label>
                    <Input
                      id="empleado-buscar-usuario"
                      value={textoUsuario}
                      placeholder="Nombre o nombre de usuario…"
                      onChange={(evento) => setTextoUsuario(evento.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="empleado-usuario">Usuario</Label>
                    <Select value={usuarioId} onValueChange={setUsuarioId}>
                      <SelectTrigger id="empleado-usuario">
                        <SelectValue placeholder="Selecciona un usuario" />
                      </SelectTrigger>
                      <SelectContent>
                        {opciones.length === 0 ? (
                          <SelectItem value="__vacio__" disabled>
                            No hay usuarios disponibles
                          </SelectItem>
                        ) : (
                          opciones.map((usuario) => (
                            <SelectItem
                              key={usuario.id}
                              value={usuario.id}
                              disabled={vinculados.data?.has(usuario.id)}
                            >
                              {usuario.nombre} (@{usuario.nombreUsuario}) ·{' '}
                              {usuario.rol}
                              {vinculados.data?.has(usuario.id)
                                ? ' · ya registrado'
                                : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Solo usuarios con rol Empleado o Gerente. Los ya
                      registrados como empleados aparecen atenuados.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="empleado-sucursal">Sucursal</Label>
                    <Input
                      id="empleado-sucursal"
                      readOnly
                      value={
                        usuarioSeleccionado
                          ? nombreSucursal(usuarioSeleccionado.sucursalId)
                          : ''
                      }
                      placeholder="Se toma del usuario seleccionado"
                    />
                  </div>
                </>
              ) : (
                <Alert>
                  <AlertTitle>Sin acceso al listado de usuarios</AlertTitle>
                  <AlertDescription>
                    No tienes permiso para ver los usuarios, así que no puedes
                    vincular un empleado desde aquí.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="empleado-fecha">Fecha de contratación</Label>
                <Input
                  id="empleado-fecha"
                  type="date"
                  value={fechaContratacion}
                  onChange={(evento) =>
                    setFechaContratacion(evento.target.value)
                  }
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="empleado-cargo">Cargo</Label>
            <Input
              id="empleado-cargo"
              value={cargo}
              maxLength={LARGO_CARGO.max}
              placeholder="barista, cajero, supervisor…"
              onChange={(evento) => setCargo(evento.target.value)}
            />
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
          <Button type="submit" form="form-empleado" disabled={pendiente}>
            {pendiente
              ? 'Guardando…'
              : esEdicion
                ? 'Guardar cambios'
                : 'Registrar empleado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
