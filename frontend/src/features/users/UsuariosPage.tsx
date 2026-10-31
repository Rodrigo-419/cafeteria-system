// Listado de usuarios con búsqueda y filtros.
//
// El Admin gestiona a cualquier usuario y ve la sucursal; el Gerente solo a los
// Empleados de su propia sucursal (el backend acota el alcance y responde 404
// fuera de él), sin columna ni filtro de sucursal. Sobre la propia cuenta no se
// ofrecen las acciones de permisos ni de estado: el backend responde 400.
import { useEffect, useMemo, useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AccionesFila, type AccionFila } from '@/components/shared/AccionesFila'
import { BarraListado } from '@/components/shared/BarraListado'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import { CambiarEstadoUsuarioDialog } from './CambiarEstadoUsuarioDialog'
import { EstadoUsuarioBadge } from './EstadoUsuarioBadge'
import { mensajeDeError } from './mensajes'
import { ESTADOS_USUARIO, ETIQUETA_ESTADO_USUARIO, ROLES_USUARIO } from './presentacion'
import type { NombreRolUsuario } from '@/lib/api/users'
import { PermisosUsuarioDialog } from './PermisosUsuarioDialog'
import { useSucursalesUsuarios, useUsuarios } from './queries'
import { UsuarioDialog } from './UsuarioDialog'
import type { EstadoUsuario, UsuarioGestionApi } from '@/types/api'

const PAGE_SIZE = 10

function idCorto(id: string): string {
  return id.length > 20 ? `${id.slice(0, 20)}…` : id
}

type Dialogo =
  | { tipo: 'crear' }
  | { tipo: 'editar'; usuario: UsuarioGestionApi }
  | { tipo: 'estado'; usuario: UsuarioGestionApi }
  | { tipo: 'permisos'; usuario: UsuarioGestionApi }
  | null

export function UsuariosPage() {
  const { usuario, permisos } = useAuth()
  const esAdmin = usuario?.rol === 'Admin'
  const puedeGestionar = tienePermiso(permisos, 'usuarios.crear_editar')
  const puedePermisos = tienePermiso(permisos, 'permisos.asignar')

  const [page, setPage] = useState(1)
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [rol, setRol] = useState<NombreRolUsuario | 'todos'>('todos')
  const [estado, setEstado] = useState<EstadoUsuario | 'todos'>('todos')
  const [sucursalAdmin, setSucursalAdmin] = useState('todas')
  const [dialogo, setDialogo] = useState<Dialogo>(null)

  useEffect(() => {
    const temporizador = setTimeout(() => {
      setBusqueda(texto)
      setPage(1)
    }, 300)
    return () => clearTimeout(temporizador)
  }, [texto])

  const sucursales = useSucursalesUsuarios(esAdmin)

  const filtros = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(busqueda.trim() !== '' ? { q: busqueda.trim() } : {}),
      ...(rol !== 'todos' ? { rol } : {}),
      ...(estado !== 'todos' ? { estado } : {}),
      ...(esAdmin && sucursalAdmin !== 'todas'
        ? { sucursalId: sucursalAdmin }
        : {}),
    }),
    [page, busqueda, rol, estado, esAdmin, sucursalAdmin],
  )

  const { data, isLoading, error, refetch } = useUsuarios(filtros)

  const nombresSucursal = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const sucursal of sucursales.data ?? []) {
      mapa.set(sucursal.id, sucursal.nombre)
    }
    return mapa
  }, [sucursales.data])

  const columnas: Column<UsuarioGestionApi>[] = [
    {
      key: 'usuario',
      header: 'Usuario',
      cell: (usuarioFila) => (
        <div>
          <p className="font-medium">{usuarioFila.nombre}</p>
          <p className="text-xs text-muted-foreground">
            {usuarioFila.nombreUsuario}
          </p>
        </div>
      ),
    },
    {
      key: 'rol',
      header: 'Rol',
      cell: (usuarioFila) => usuarioFila.rol,
    },
    ...(esAdmin
      ? [
          {
            key: 'sucursal',
            header: 'Sucursal',
            cell: (usuarioFila: UsuarioGestionApi) =>
              usuarioFila.sucursalId
                ? nombresSucursal.get(usuarioFila.sucursalId) ??
                  idCorto(usuarioFila.sucursalId)
                : '—',
          } satisfies Column<UsuarioGestionApi>,
        ]
      : []),
    {
      key: 'estado',
      header: 'Estado',
      cell: (usuarioFila) => <EstadoUsuarioBadge estado={usuarioFila.estado} />,
    },
    ...(puedeGestionar || puedePermisos
      ? [
          {
            key: 'acciones',
            header: '',
            className: 'text-right',
            cell: (usuarioFila: UsuarioGestionApi) => {
              const esPropia = usuarioFila.id === usuario?.id
              const acciones: AccionFila[] = []

              if (puedePermisos && !esPropia) {
                acciones.push({
                  etiqueta: 'Permisos',
                  onSelect: () =>
                    setDialogo({ tipo: 'permisos', usuario: usuarioFila }),
                })
              }
              if (puedeGestionar && !esPropia) {
                const bloquea = usuarioFila.estado === 'activo'
                acciones.push({
                  etiqueta: bloquea ? 'Bloquear' : 'Activar',
                  destructiva: bloquea,
                  onSelect: () =>
                    setDialogo({ tipo: 'estado', usuario: usuarioFila }),
                })
              }

              const principal = puedeGestionar ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDialogo({ tipo: 'editar', usuario: usuarioFila })
                  }
                >
                  Editar
                </Button>
              ) : puedePermisos && !esPropia ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDialogo({ tipo: 'permisos', usuario: usuarioFila })
                  }
                >
                  Permisos
                </Button>
              ) : undefined

              return <AccionesFila principal={principal} acciones={acciones} />
            },
          } satisfies Column<UsuarioGestionApi>,
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Cuentas del sistema, su rol y sus permisos"
      />

      <BarraListado
        busqueda={{
          id: 'usuario-busqueda',
          value: texto,
          onChange: setTexto,
          placeholder: 'Nombre o usuario…',
        }}
        filtrosActivos={
          Number(rol !== 'todos') +
          Number(estado !== 'todos') +
          Number(esAdmin && sucursalAdmin !== 'todas')
        }
        filtros={
          <>
            <div className="space-y-2">
              <Label htmlFor="usuario-filtro-rol">Rol</Label>
              <Select
                value={rol}
                onValueChange={(valor) => {
                  setRol(valor as NombreRolUsuario | 'todos')
                  setPage(1)
                }}
              >
                <SelectTrigger id="usuario-filtro-rol">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {ROLES_USUARIO.map((opcion) => (
                    <SelectItem key={opcion} value={opcion}>
                      {opcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="usuario-filtro-estado">Estado</Label>
              <Select
                value={estado}
                onValueChange={(valor) => {
                  setEstado(valor as EstadoUsuario | 'todos')
                  setPage(1)
                }}
              >
                <SelectTrigger id="usuario-filtro-estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {ESTADOS_USUARIO.map((estadoOp) => (
                    <SelectItem key={estadoOp} value={estadoOp}>
                      {ETIQUETA_ESTADO_USUARIO[estadoOp]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {esAdmin && (
              <div className="space-y-2">
                <Label htmlFor="usuario-filtro-sucursal">Sucursal</Label>
                <Select
                  value={sucursalAdmin}
                  onValueChange={(valor) => {
                    setSucursalAdmin(valor)
                    setPage(1)
                  }}
                >
                  <SelectTrigger id="usuario-filtro-sucursal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {(sucursales.data ?? []).map((sucursal) => (
                      <SelectItem key={sucursal.id} value={sucursal.id}>
                        {sucursal.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        }
        accionPrimaria={
          puedeGestionar ? (
            <Button onClick={() => setDialogo({ tipo: 'crear' })}>
              <PlusIcon className="size-4" />
              Crear usuario
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columnas}
        data={data?.data ?? []}
        isLoading={isLoading}
        error={error ? mensajeDeError(error, 'listar') : null}
        onRetry={() => void refetch()}
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.total}
        onPageChange={setPage}
        getRowId={(usuarioFila) => usuarioFila.id}
        emptyTitle="Sin usuarios"
        emptyDescription="No hay usuarios que coincidan con los filtros en tu alcance."
      />

      {(dialogo?.tipo === 'crear' || dialogo?.tipo === 'editar') && (
        <UsuarioDialog
          usuario={dialogo.tipo === 'editar' ? dialogo.usuario : null}
          esPropia={
            dialogo.tipo === 'editar' && dialogo.usuario.id === usuario?.id
          }
          onClose={() => setDialogo(null)}
        />
      )}

      {dialogo?.tipo === 'estado' && (
        <CambiarEstadoUsuarioDialog
          usuario={dialogo.usuario}
          onClose={() => setDialogo(null)}
        />
      )}

      {dialogo?.tipo === 'permisos' && (
        <PermisosUsuarioDialog
          usuario={dialogo.usuario}
          onClose={() => setDialogo(null)}
        />
      )}
    </div>
  )
}