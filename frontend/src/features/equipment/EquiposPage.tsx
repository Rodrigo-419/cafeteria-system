// Listado de equipos con búsqueda y filtros.
//
// El Admin ve todas las sucursales y puede filtrar por sucursal; el Gerente y el
// Empleado solo ven la suya (el backend acota el alcance y responde 404 fuera de
// él). El estado se muestra como badge con color + etiqueta. Solo quien puede
// editar ve las acciones, y un equipo retirado no ofrece cambio de estado
// (estado terminal).
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
import { tienePermiso } from '@/lib/permissions/permissions'
import { CambiarEstadoDialog } from './CambiarEstadoDialog'
import { EquipoDialog } from './EquipoDialog'
import { EstadoEquipoBadge } from './EstadoEquipoBadge'
import { mensajeDeError } from './mensajes'
import {
  esEstadoTerminal,
  ESTADOS_EQUIPO,
  ETIQUETA_ESTADO_EQUIPO,
} from './presentacion'
import { useEquipos, useSucursalesEquipos } from './queries'
import type { EquipoApi, EstadoEquipo } from '@/types/api'

const PAGE_SIZE = 10

function idCorto(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

type Dialogo =
  | { tipo: 'crear' }
  | { tipo: 'editar'; equipo: EquipoApi }
  | { tipo: 'estado'; equipo: EquipoApi }
  | null

export function EquiposPage() {
  const { usuario, permisos } = useAuth()
  const esAdmin = usuario?.rol === 'Admin'
  const puedeVer = tienePermiso(permisos, 'equipo.ver')
  const puedeEditar = tienePermiso(permisos, 'equipo.registrar_editar')

  const [page, setPage] = useState(1)
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<EstadoEquipo | 'todos'>('todos')
  const [sucursalAdmin, setSucursalAdmin] = useState('todas')
  const [dialogo, setDialogo] = useState<Dialogo>(null)

  useEffect(() => {
    const temporizador = setTimeout(() => {
      setBusqueda(texto)
      setPage(1)
    }, 300)
    return () => clearTimeout(temporizador)
  }, [texto])

  const sucursales = useSucursalesEquipos(esAdmin)

  const filtros = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(busqueda.trim() !== '' ? { busqueda: busqueda.trim() } : {}),
      ...(estado !== 'todos' ? { estado } : {}),
      ...(esAdmin && sucursalAdmin !== 'todas'
        ? { sucursalId: sucursalAdmin }
        : {}),
    }),
    [page, busqueda, estado, esAdmin, sucursalAdmin],
  )

  const { data, isLoading, error, refetch } = useEquipos(filtros)

  const nombresSucursal = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const sucursal of sucursales.data ?? []) {
      mapa.set(sucursal.id, sucursal.nombre)
    }
    return mapa
  }, [sucursales.data])

  const columnas: Column<EquipoApi>[] = [
    {
      key: 'nombre',
      header: 'Equipo',
      cell: (equipo) =>
        puedeVer ? (
          <Link
            to={`/equipment/${equipo.id}`}
            className="font-medium text-primary hover:underline"
          >
            {equipo.nombre}
          </Link>
        ) : (
          <span className="font-medium">{equipo.nombre}</span>
        ),
    },
    { key: 'tipo', header: 'Tipo', cell: (equipo) => equipo.tipo },
    ...(esAdmin
      ? [
          {
            key: 'sucursal',
            header: 'Sucursal',
            cell: (equipo: EquipoApi) =>
              nombresSucursal.get(equipo.sucursalId) ??
              idCorto(equipo.sucursalId),
          } satisfies Column<EquipoApi>,
        ]
      : []),
    {
      key: 'estado',
      header: 'Estado',
      cell: (equipo) => <EstadoEquipoBadge estado={equipo.estado} />,
    },
    {
      key: 'observaciones',
      header: 'Observaciones',
      cell: (equipo) => (
        <span
          className="block max-w-[16rem] truncate text-muted-foreground"
          title={equipo.observaciones ?? undefined}
        >
          {equipo.observaciones ?? '—'}
        </span>
      ),
    },
    ...(puedeVer || puedeEditar
      ? [
          {
            key: 'acciones',
            header: '',
            className: 'text-right',
            cell: (equipo: EquipoApi) => (
              <div className="flex justify-end gap-1">
                {puedeVer && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/equipment/${equipo.id}`}>Ver detalle</Link>
                  </Button>
                )}
                {puedeEditar && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDialogo({ tipo: 'editar', equipo })}
                  >
                    Editar
                  </Button>
                )}
                {puedeEditar && !esEstadoTerminal(equipo.estado) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDialogo({ tipo: 'estado', equipo })}
                  >
                    Cambiar estado
                  </Button>
                )}
              </div>
            ),
          } satisfies Column<EquipoApi>,
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipos"
        description="Gestión y estado operativo de los equipos por sucursal"
        actions={
          puedeEditar ? (
            <Button onClick={() => setDialogo({ tipo: 'crear' })}>
              <PlusIcon className="size-4" />
              Registrar equipo
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="equipo-busqueda">Buscar</Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="equipo-busqueda"
                className="pl-9"
                value={texto}
                placeholder="Nombre o tipo…"
                onChange={(evento) => setTexto(evento.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="equipo-filtro-estado">Estado</Label>
            <Select
              value={estado}
              onValueChange={(valor) => {
                setEstado(valor as EstadoEquipo | 'todos')
                setPage(1)
              }}
            >
              <SelectTrigger id="equipo-filtro-estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ESTADOS_EQUIPO.map((valor) => (
                  <SelectItem key={valor} value={valor}>
                    {ETIQUETA_ESTADO_EQUIPO[valor]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {esAdmin && (
            <div className="space-y-2">
              <Label htmlFor="equipo-filtro-sucursal">Sucursal</Label>
              <Select
                value={sucursalAdmin}
                onValueChange={(valor) => {
                  setSucursalAdmin(valor)
                  setPage(1)
                }}
              >
                <SelectTrigger id="equipo-filtro-sucursal">
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
        getRowId={(equipo) => equipo.id}
        emptyTitle="Sin equipos"
        emptyDescription="No hay equipos que coincidan con los filtros en tu alcance."
      />

      {(dialogo?.tipo === 'crear' || dialogo?.tipo === 'editar') && (
        <EquipoDialog
          equipo={dialogo.tipo === 'editar' ? dialogo.equipo : null}
          onClose={() => setDialogo(null)}
        />
      )}

      {dialogo?.tipo === 'estado' && (
        <CambiarEstadoDialog
          equipo={dialogo.equipo}
          onClose={() => setDialogo(null)}
        />
      )}
    </div>
  )
}
