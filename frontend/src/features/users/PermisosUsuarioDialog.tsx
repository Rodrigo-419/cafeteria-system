// Diálogo de permisos efectivos de un usuario.
//
// La API expone solo los permisos del rol del objetivo más las asignaciones
// individuales (`GET /users/:id/permisos`), así que aquí se puede: revocar un
// permiso que el rol otorga (queda como `revocado`), conceder de nuevo uno
// revocado y quitar una concesión individual (vuelve al valor del rol). No se
// puede conceder un permiso que no aparezca (la API no expone el catálogo).
//
// Se replican las reglas reales habilitando o no cada acción: solo se otorga un
// permiso que el actor posee; a un Empleado solo los 4 de la matriz; y la
// revocación aplica únicamente a lo que el rol concede por defecto. El backend
// valida igual y sus errores 400 se muestran tal cual.
import { useMemo, useState } from 'react'
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
import { StatusPill } from '@/components/shared/StatusPill'
import { useAuth } from '@/lib/auth/useAuth'
import {
  tienePermiso,
  type CodigoPermiso,
} from '@/lib/permissions/permissions'
import {
  ETIQUETA_ORIGEN_PERMISO,
  areaDePermiso,
} from '@/lib/permissions/etiquetas'
import { HistorialUsuario } from '@/features/audit/HistorialUsuario'
import { mensajeDeError } from './mensajes'
import { PERMISOS_CONCEDIBLES_A_EMPLEADO } from './presentacion'
import {
  useAsignarPermisoUsuario,
  useEliminarPermisoUsuario,
  usePermisosUsuario,
} from './queries'
import type { PermisoEfectivoApi, UsuarioGestionApi } from '@/types/api'

interface PermisosUsuarioDialogProps {
  usuario: UsuarioGestionApi
  onClose: () => void
}

export function PermisosUsuarioDialog({
  usuario,
  onClose,
}: PermisosUsuarioDialogProps) {
  const { usuario: actor } = useAuth()
  const permisosEfectivos = usePermisosUsuario(usuario.id)
  const asignar = useAsignarPermisoUsuario()
  const eliminar = useEliminarPermisoUsuario()
  const esPropia = actor?.id === usuario.id

  const puedeVerHistorial =
    actor != null && tienePermiso(actor.permisos, 'usuarios.crear_editar')

  const [error, setError] = useState<string | null>(null)
  const [cambiando, setCambiando] = useState<string | null>(null)

  const pendiente = cambiando !== null

  const puedeConceder = (codigo: string): boolean => {
    if (esPropia || !actor) return false
    if (!tienePermiso(actor.permisos, codigo as CodigoPermiso)) return false
    if (
      usuario.rol === 'Empleado' &&
      !PERMISOS_CONCEDIBLES_A_EMPLEADO.includes(
        codigo as (typeof PERMISOS_CONCEDIBLES_A_EMPLEADO)[number],
      )
    ) {
      return false
    }
    return true
  }

  const puedeRevocar = (codigo: string): boolean =>
    !esPropia &&
    actor != null &&
    tienePermiso(actor.permisos, codigo as CodigoPermiso)

  const grupos = useMemo(() => {
    const orden: { nombre: string; etiqueta: string; items: PermisoEfectivoApi[] }[] = []
    const indice = new Map<string, number>()
    for (const permiso of permisosEfectivos.data ?? []) {
      const etiqueta = areaDePermiso(permiso.codigo)
      const previo = indice.get(etiqueta)
      if (previo === undefined) {
        indice.set(etiqueta, orden.length)
        orden.push({ nombre: etiqueta, etiqueta, items: [permiso] })
      } else {
        orden[previo]!.items.push(permiso)
      }
    }
    return orden
  }, [permisosEfectivos.data])

  function terminarCambio(_permisoId: string) {
    setCambiando(null)
  }

  function conceder(permiso: PermisoEfectivoApi) {
    setError(null)
    setCambiando(permiso.permisoId)
    asignar.mutate(
      { id: usuario.id, permisoId: permiso.permisoId, tipo: 'concedido' },
      {
        onSuccess: () => toast.success(`Permiso concedido a ${usuario.nombre}`),
        onSettled: () => terminarCambio(permiso.permisoId),
        onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'permisos')),
      },
    )
  }

  function revocar(permiso: PermisoEfectivoApi) {
    setError(null)
    setCambiando(permiso.permisoId)
    asignar.mutate(
      { id: usuario.id, permisoId: permiso.permisoId, tipo: 'revocado' },
      {
        onSuccess: () => toast.success(`Permiso revocado a ${usuario.nombre}`),
        onSettled: () => terminarCambio(permiso.permisoId),
        onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'permisos')),
      },
    )
  }

  function quitar(permiso: PermisoEfectivoApi) {
    setError(null)
    setCambiando(permiso.permisoId)
    eliminar.mutate(
      { id: usuario.id, permisoId: permiso.permisoId },
      {
        onSuccess: () =>
          toast.success('Concesión retirada: vuelve al valor que da el rol'),
        onSettled: () => terminarCambio(permiso.permisoId),
        onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'permisos')),
      },
    )
  }

  function restablecer(permiso: PermisoEfectivoApi) {
    setError(null)
    setCambiando(permiso.permisoId)
    eliminar.mutate(
      { id: usuario.id, permisoId: permiso.permisoId },
      {
        onSuccess: () => toast.success('Permiso restablecido al valor del rol'),
        onSettled: () => terminarCambio(permiso.permisoId),
        onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'permisos')),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Permisos de {usuario.nombre}</DialogTitle>
          <DialogDescription>
            Rol {usuario.rol}
            {usuario.sucursalId ? ` · sucursal ${usuario.sucursalId}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {esPropia && (
            <Alert variant="destructive">
              <AlertTitle>No puedes modificar tus propios permisos</AlertTitle>
              <AlertDescription>
                Esta lista es de solo lectura para tu cuenta.
              </AlertDescription>
            </Alert>
          )}

          {permisosEfectivos.isLoading && (
            <p className="text-sm text-muted-foreground">Cargando permisos…</p>
          )}

          {permisosEfectivos.error && (
            <Alert variant="destructive">
              <AlertTitle>No se pudieron cargar los permisos</AlertTitle>
              <AlertDescription>
                {mensajeDeError(permisosEfectivos.error, 'permisos')}
              </AlertDescription>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void permisosEfectivos.refetch()}
              >
                Reintentar
              </Button>
            </Alert>
          )}

          {!permisosEfectivos.isLoading &&
            !permisosEfectivos.error &&
            permisosEfectivos.data &&
            permisosEfectivos.data.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Este usuario no tiene permisos asignables.
              </p>
            )}

          {!permisosEfectivos.isLoading &&
            !permisosEfectivos.error &&
            grupos.map((grupo) => (
              <div key={grupo.nombre} className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {grupo.etiqueta}
                </h3>
                {grupo.items.map((permiso) => {
                  const accion =
                    permiso.origen === 'revocado'
                      ? 'restablecer'
                      : permiso.origen === 'concedido'
                        ? 'quitar'
                        : permiso.efectivo
                          ? 'revocar'
                          : 'conceder'
                  const habilitada =
                    !pendiente &&
                    (accion === 'revocar'
                      ? puedeRevocar(permiso.codigo)
                      : accion === 'conceder'
                        ? puedeConceder(permiso.codigo)
                        : !esPropia)

                  const tituloAccion =
                    accion === 'conceder' && !puedeConceder(permiso.codigo)
                      ? usuario.rol === 'Empleado'
                        ? 'Este permiso no se puede conceder a un Empleado.'
                        : 'No puedes conceder un permiso que no posees.'
                      : accion === 'revocar' && !puedeRevocar(permiso.codigo)
                        ? 'No puedes revocar un permiso que no posees.'
                        : undefined

                  return (
                    <div
                      key={permiso.permisoId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-medium">
                          {permiso.descripcion}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {ETIQUETA_ORIGEN_PERMISO[permiso.origen]}
                          </span>
                          {permiso.efectivo ? (
                            <StatusPill tono="success">Activo</StatusPill>
                          ) : (
                            <StatusPill tono="error">Inactivo</StatusPill>
                          )}
                        </div>
                      </div>
                      {!esPropia && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!habilitada}
                          title={tituloAccion}
                          onClick={() => {
                            if (accion === 'revocar') revocar(permiso)
                            else if (accion === 'quitar') quitar(permiso)
                            else if (accion === 'restablecer')
                              restablecer(permiso)
                            else conceder(permiso)
                          }}
                        >
                          {cambiando === permiso.permisoId
                            ? 'Guardando…'
                            : accion === 'revocar'
                              ? 'Revocar'
                              : accion === 'quitar'
                                ? 'Quitar'
                                : accion === 'restablecer'
                                  ? 'Restablecer'
                                  : 'Conceder'}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo aplicar el cambio</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {puedeVerHistorial && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Historial
              </h3>
              <HistorialUsuario usuarioId={usuario.id} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pendiente}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}