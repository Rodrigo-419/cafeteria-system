// Diálogo de alta y edición de usuarios. Se monta solo cuando está abierto, de
// modo que su estado interno (incluida la contraseña recién generada) se
// descarta al cerrar.
//
// El Admin elige rol y sucursal; un Gerente crea siempre un Empleado en su
// propia sucursal, así que no ve selectores. Nadie puede cambiar su propio rol
// ni sucursal (el backend responde 400), así que en la propia fila esos campos
// se muestran como texto y la edición se limita a nombre y nombre de usuario.
//
// La contraseña solo se pide en el alta. Con "Generar contraseña" se crea una
// aleatoria de 20 caracteres que se muestra una sola vez, con botón de copiar
// y aviso de no persistencia; también se puede escribir una propia (12
// caracteres de mínimo, igual que la política del backend).
import { useState } from 'react'
import { cn } from 'cn'
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
import { PasswordReveal } from '@/components/shared/PasswordReveal'
import { useAuth } from '@/lib/auth/useAuth'
import type {
  EntradaActualizarUsuario,
  NombreRolUsuario,
} from '@/lib/api/users'
import { generarPassword } from './generador-password'
import { mensajeDeError } from './mensajes'
import {
  LARGO_NOMBRE,
  LARGO_NOMBRE_USUARIO,
  ROLES_USUARIO,
  ayudaPassword,
  mensajeNombre,
  mensajeNombreUsuario,
  mensajePassword,
  normalizarNombreUsuario,
} from './presentacion'
import {
  useActualizarUsuario,
  useCrearUsuario,
  useSucursalesUsuarios,
} from './queries'
import type { UsuarioGestionApi } from '@/types/api'

interface UsuarioDialogProps {
  usuario?: UsuarioGestionApi | null
  /** `true` cuando la fila es la cuenta con sesión: rol y sucursal quedan fijos. */
  esPropia: boolean
  onClose: () => void
}

function idCorto(id: string): string {
  return id.length > 20 ? `${id.slice(0, 20)}…` : id
}

export function UsuarioDialog({
  usuario,
  esPropia,
  onClose,
}: UsuarioDialogProps) {
  const { usuario: actor } = useAuth()
  const esAdmin = actor?.rol === 'Admin'
  const esCreacion = usuario == null

  const [nombre, setNombre] = useState(usuario?.nombre ?? '')
  const [nombreUsuario, setNombreUsuario] = useState(usuario?.nombreUsuario ?? '')
  const [rol, setRol] = useState<NombreRolUsuario>(
    (usuario?.rol as NombreRolUsuario | undefined) ?? 'Empleado',
  )
  const [sucursalId, setSucursalId] = useState(
    usuario?.sucursalId ?? (esAdmin ? '' : actor?.sucursalId ?? ''),
  )
  const [password, setPassword] = useState('')
  const [generada, setGenerada] = useState('')
  const [error, setError] = useState<string | null>(null)

  const sucursales = useSucursalesUsuarios(true)
  const crear = useCrearUsuario()
  const actualizar = useActualizarUsuario()
  const pendiente = crear.isPending || actualizar.isPending

  // El rol solo lo elige el Admin, y nunca sobre su propia cuenta. Un Gerente
  // crea Empleados en su sucursal; al editar un Empleado tampoco cambia rol.
  const rolEditable = esAdmin && (esCreacion || !esPropia)
  const rolFijado = rolEditable ? null : esCreacion ? 'Empleado' : (usuario?.rol as NombreRolUsuario)
  const sucursalEditable = esAdmin && !esPropia

  const nombreUsuarioNormalizado = normalizarNombreUsuario(nombreUsuario)
  const nombreValido = mensajeNombre(nombre) === null
  const nombreUsuarioValido = mensajeNombreUsuario(nombreUsuario) === null
  const passwordValida = !esCreacion || mensajePassword(password) === null
  const requiereSucursal = rolFijado ? rolFijado !== 'Admin' : rol !== 'Admin'
  const sucursalValida = !requiereSucursal || sucursalId !== ''
  const valido = nombreValido && nombreUsuarioValido && passwordValida && sucursalValida

  const nombreSucursal =
    sucursales.data?.find((sucursal) => sucursal.id === sucursalId)?.nombre ?? ''

  function generarTemporal() {
    const temporal = generarPassword()
    setPassword(temporal)
    setGenerada(temporal)
    setError(null)
  }

  function guardar() {
    if (!valido) return
    setError(null)
    const normalizado = nombreUsuarioNormalizado

    if (esCreacion) {
      const rolFinal: NombreRolUsuario = rolFijado ?? rol
      const destino =
        esAdmin && !esPropia
          ? rolFinal === 'Admin'
            ? null
            : sucursalId
          : actor?.sucursalId ?? null
      crear.mutate(
        {
          nombre: nombre.trim(),
          nombreUsuario: normalizado,
          password,
          rol: rolFinal,
          ...(destino !== null ? { sucursalId: destino } : {}),
        },
        {
          onSuccess: () => {
            toast.success('Usuario creado')
            onClose()
          },
          onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'crear')),
        },
      )
      return
    }

    if (!usuario) return
    const entrada: EntradaActualizarUsuario = {
      nombre: nombre.trim(),
      nombreUsuario: normalizado,
    }
    if (esAdmin && !esPropia) {
      const rolFinal: NombreRolUsuario = rol
      entrada.rol = rolFinal
      entrada.sucursalId = rolFinal === 'Admin' ? null : sucursalId
    }
    actualizar.mutate(
      { id: usuario.id, entrada },
      {
        onSuccess: () => {
          toast.success('Usuario actualizado')
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
          <DialogTitle>{esCreacion ? 'Crear usuario' : 'Editar usuario'}</DialogTitle>
          <DialogDescription>
            {esCreacion
              ? esAdmin
                ? 'Define el rol y, para Gerente o Empleado, la sucursal.'
                : 'Se creará un Empleado en tu sucursal.'
              : esPropia
                ? 'Puedes cambiar tu nombre y nombre de usuario; tu rol y sucursal quedan fijos.'
                : 'Actualiza los datos del usuario. El Admin es quien cambia rol y sucursal.'}
          </DialogDescription>
        </DialogHeader>
        <form
          id="form-usuario"
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            guardar()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="usuario-nombre">Nombre</Label>
            <Input
              id="usuario-nombre"
              value={nombre}
              maxLength={LARGO_NOMBRE.max}
              onChange={(evento) => setNombre(evento.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground">
              {nombre.length}/{LARGO_NOMBRE.max}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="usuario-nombre-usuario">Nombre de usuario</Label>
            <Input
              id="usuario-nombre-usuario"
              value={nombreUsuario}
              maxLength={LARGO_NOMBRE_USUARIO.max}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="usuario.ejemplo"
              onChange={(evento) => setNombreUsuario(evento.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Solo minúsculas, números, puntos, guiones o guiones bajos. Se
              guarda sin espacios y en minúsculas.
            </p>
          </div>

          {rolEditable ? (
            <div className="space-y-2">
              <Label htmlFor="usuario-rol">Rol</Label>
              <Select
                value={rol}
                onValueChange={(valor) => {
                  setRol(valor as NombreRolUsuario)
                  if (valor === 'Admin') setSucursalId('')
                }}
              >
                <SelectTrigger id="usuario-rol">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES_USUARIO.map((opcion) => (
                    <SelectItem key={opcion} value={opcion}>
                      {opcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            rolFijado && (
              <div className="space-y-2">
                <Label>Rol</Label>
                <p className="rounded-md border border-border px-3 py-2 text-sm">
                  {rolFijado}
                </p>
              </div>
            )
          )}

          {sucursalEditable ? (
            <div className="space-y-2">
              <Label htmlFor="usuario-sucursal">Sucursal</Label>
              <Select
                value={sucursalId}
                onValueChange={setSucursalId}
                disabled={!requiereSucursal}
              >
                <SelectTrigger id="usuario-sucursal">
                  <SelectValue
                    placeholder={requiereSucursal ? 'Selecciona una sucursal' : 'Sin sucursal'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(sucursales.data ?? []).map((sucursal) => (
                    <SelectItem key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!requiereSucursal && (
                <p className="text-xs text-muted-foreground">
                  Un Admin no pertenece a ninguna sucursal.
                </p>
              )}
            </div>
          ) : (
            requiereSucursal && (
              <div className="space-y-2">
                <Label>Sucursal</Label>
                <p className="rounded-md border border-border px-3 py-2 text-sm">
                  {nombreSucursal || idCorto(sucursalId)}
                </p>
              </div>
            )
          )}

          {esCreacion && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="usuario-password">Contraseña</Label>
                <Input
                  id="usuario-password"
                  type="password"
                  value={password}
                  autoComplete="new-password"
                  aria-describedby="usuario-password-ayuda"
                  aria-invalid={!passwordValida}
                  onChange={(evento) => setPassword(evento.target.value)}
                />
                <p
                  id="usuario-password-ayuda"
                  className={cn(
                    'text-xs',
                    passwordValida
                      ? 'text-muted-foreground'
                      : 'text-destructive',
                  )}
                >
                  {ayudaPassword(password)}
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={generarTemporal}
                  disabled={pendiente}
                >
                  Generar contraseña
                </Button>
                {generada !== '' && (
                  <div className="space-y-2">
                    <PasswordReveal
                      id="usuario-password-generada"
                      valor={generada}
                    />
                    <Alert>
                      <AlertTitle>Contraseña de un solo uso</AlertTitle>
                      <AlertDescription>
                        Cópiala ahora y entrégala al usuario en persona: al
                        cerrar esta ventana dejará de estar disponible.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
            </div>
          )}

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
          <Button type="submit" form="form-usuario" disabled={!valido || pendiente}>
            {pendiente
              ? 'Guardando…'
              : esCreacion
                ? 'Crear usuario'
                : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}