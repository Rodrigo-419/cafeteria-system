// Listado de empleados con búsqueda y filtros.
//
// El Admin ve todas las sucursales y puede filtrar por sucursal; el Gerente solo
// ve los empleados de su sucursal (el backend acota el alcance). El estado se
// muestra como badge. Solo quien puede gestionar ve las acciones, y un empleado
// cesado no ofrece cese ni generación de PIN.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/lib/auth/useAuth'
import { formatearDiaLocal } from '@/lib/format/dates'
import { tienePermiso } from '@/lib/permissions/permissions'
import { CesarEmpleadoDialog } from './CesarEmpleadoDialog'
import { EmpleadoDialog } from './EmpleadoDialog'
import { EstadoEmpleadoBadge } from './EstadoEmpleadoBadge'
import { GenerarPinDialog } from './GenerarPinDialog'
import { mensajeDeError } from './mensajes'
import {
  ESTADOS_EMPLEADO,
  ETIQUETA_ESTADO_EMPLEADO,
} from './presentacion'
import { useEmpleados, useSucursalesEmpleados } from './queries'
import { BotonExportar } from '@/features/exports/BotonExportar'
import type { EmpleadoApi, EstadoEmpleado } from '@/types/api'

const PAGE_SIZE = 10

function idCorto(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

type Dialogo =
  | { tipo: 'crear' }
  | { tipo: 'editar'; empleado: EmpleadoApi }
  | { tipo: 'cesar'; empleado: EmpleadoApi }
  | { tipo: 'pin'; empleado: EmpleadoApi }
  | null

export function EmpleadosPage() {
  const { usuario, permisos } = useAuth()
  const esAdmin = usuario?.rol === 'Admin'
  const puedeGestionar = tienePermiso(permisos, 'empleados.crear_editar')

  const [page, setPage] = useState(1)
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<EstadoEmpleado | 'todos'>('todos')
  const [sucursalAdmin, setSucursalAdmin] = useState('todas')
  const [dialogo, setDialogo] = useState<Dialogo>(null)

  useEffect(() => {
    const temporizador = setTimeout(() => {
      setBusqueda(texto)
      setPage(1)
    }, 300)
    return () => clearTimeout(temporizador)
  }, [texto])

  const sucursales = useSucursalesEmpleados(esAdmin)

  const filtros = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(busqueda.trim() !== '' ? { q: busqueda.trim() } : {}),
      ...(estado !== 'todos' ? { estado } : {}),
      ...(esAdmin && sucursalAdmin !== 'todas'
        ? { sucursalId: sucursalAdmin }
        : {}),
    }),
    [page, busqueda, estado, esAdmin, sucursalAdmin],
  )

  const { data, isLoading, error, refetch } = useEmpleados(filtros)

  const nombresSucursal = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const sucursal of sucursales.data ?? []) {
      mapa.set(sucursal.id, sucursal.nombre)
    }
    return mapa
  }, [sucursales.data])

  const columnas: Column<EmpleadoApi>[] = [
    {
      key: 'colaborador',
      header: 'Colaborador',
      cell: (empleado) => (
        <div className="flex flex-col">
          <Link
            to={`/employees/${empleado.id}`}
            className="font-medium text-primary hover:underline"
          >
            {empleado.usuario.nombre}
          </Link>
          <span className="text-xs text-muted-foreground">
            @{empleado.usuario.nombreUsuario} · {empleado.usuario.rol}
          </span>
        </div>
      ),
    },
    { key: 'cargo', header: 'Cargo', cell: (empleado) => empleado.cargo },
    ...(esAdmin
      ? [
          {
            key: 'sucursal',
            header: 'Sucursal',
            cell: (empleado: EmpleadoApi) =>
              nombresSucursal.get(empleado.sucursalId) ??
              idCorto(empleado.sucursalId),
          } satisfies Column<EmpleadoApi>,
        ]
      : []),
    {
      key: 'contratacion',
      header: 'Contratación',
      cell: (empleado) => formatearDiaLocal(empleado.fechaContratacion),
    },
    {
      key: 'estado',
      header: 'Estado',
      cell: (empleado) => <EstadoEmpleadoBadge estado={empleado.estado} />,
    },
    {
      key: 'acciones',
      header: '',
      className: 'text-right',
      cell: (empleado) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/employees/${empleado.id}`}>Ver detalle</Link>
          </Button>
          {puedeGestionar && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialogo({ tipo: 'editar', empleado })}
            >
              Editar
            </Button>
          )}
          {puedeGestionar && empleado.estado === 'activo' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDialogo({ tipo: 'pin', empleado })}
              >
                Generar PIN
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDialogo({ tipo: 'cesar', empleado })}
              >
                Cesar
              </Button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empleados"
        description="Personal vinculado a las cuentas de usuario"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BotonExportar conjunto="empleados" />
            {puedeGestionar && (
              <Button onClick={() => setDialogo({ tipo: 'crear' })}>
                <PlusIcon className="size-4" />
                Registrar empleado
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="empleado-busqueda">Buscar</Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="empleado-busqueda"
                className="pl-9"
                value={texto}
                placeholder="Nombre, usuario o cargo…"
                onChange={(evento) => setTexto(evento.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="empleado-filtro-estado">Estado</Label>
            <Select
              value={estado}
              onValueChange={(valor) => {
                setEstado(valor as EstadoEmpleado | 'todos')
                setPage(1)
              }}
            >
              <SelectTrigger id="empleado-filtro-estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ESTADOS_EMPLEADO.map((valor) => (
                  <SelectItem key={valor} value={valor}>
                    {ETIQUETA_ESTADO_EMPLEADO[valor]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {esAdmin && (
            <div className="space-y-2">
              <Label htmlFor="empleado-filtro-sucursal">Sucursal</Label>
              <Select
                value={sucursalAdmin}
                onValueChange={(valor) => {
                  setSucursalAdmin(valor)
                  setPage(1)
                }}
              >
                <SelectTrigger id="empleado-filtro-sucursal">
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
        </CardContent>
      </Card>

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
        getRowId={(empleado) => empleado.id}
        emptyTitle="Sin empleados"
        emptyDescription="No hay empleados que coincidan con los filtros en tu alcance."
      />

      {(dialogo?.tipo === 'crear' || dialogo?.tipo === 'editar') && (
        <EmpleadoDialog
          empleado={dialogo.tipo === 'editar' ? dialogo.empleado : null}
          onClose={() => setDialogo(null)}
        />
      )}

      {dialogo?.tipo === 'cesar' && (
        <CesarEmpleadoDialog
          empleado={dialogo.empleado}
          onClose={() => setDialogo(null)}
        />
      )}

      {dialogo?.tipo === 'pin' && (
        <GenerarPinDialog
          empleado={dialogo.empleado}
          onClose={() => setDialogo(null)}
        />
      )}
    </div>
  )
}
