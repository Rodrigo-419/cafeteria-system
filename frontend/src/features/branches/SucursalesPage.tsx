// Listado de sucursales con búsqueda.
//
// El Admin ve todas las sucursales del negocio (ordenadas por nombre en el
// backend) y puede crear/editar; el Gerente y el Empleado solo ven la suya,
// porque el backend acota el alcance y responde 404 para cualquier otra. La
// página se protege con `sucursales.ver`, que el backend exige para el listado
// y para obtener una sucursal; para crear o editar se exige además
// `sucursales.crear_editar` y el botón respectivo se oculta sin ese permiso.
import { useEffect, useMemo, useState } from 'react'
import { PlusIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import { mensajeDeError } from './mensajes'
import { useSucursales } from './queries'
import { SucursalDialog } from './SucursalDialog'
import type { SucursalApi } from '@/types/api'

type Dialogo =
  | { tipo: 'crear' }
  | { tipo: 'editar'; sucursal: SucursalApi }
  | null

export function SucursalesPage() {
  const { permisos } = useAuth()
  const puedeCrearEditar = tienePermiso(permisos, 'sucursales.crear_editar')

  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [dialogo, setDialogo] = useState<Dialogo>(null)

  useEffect(() => {
    const temporizador = setTimeout(() => {
      setBusqueda(texto)
    }, 300)
    return () => clearTimeout(temporizador)
  }, [texto])

  const { data, isLoading, error, refetch } = useSucursales()

  const lista = useMemo(() => {
    if (!data) return []
    const q = busqueda.trim().toLowerCase()
    if (!q) return data
    return data.filter((sucursal) => {
      const nombre = sucursal.nombre.toLowerCase()
      const direccion = sucursal.direccion.toLowerCase()
      return nombre.includes(q) || direccion.includes(q)
    })
  }, [data, busqueda])

  const columnas: Column<SucursalApi>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      cell: (fila) => <span className="font-medium">{fila.nombre}</span>,
    },
    {
      key: 'direccion',
      header: 'Dirección',
      cell: (fila) => fila.direccion,
    },
    {
      key: 'telefono',
      header: 'Teléfono',
      cell: (fila) => fila.telefono ?? '—',
    },
    ...(puedeCrearEditar
      ? [
          {
            key: 'acciones',
            header: '',
            className: 'text-right',
            cell: (fila: SucursalApi) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDialogo({ tipo: 'editar', sucursal: fila })}
                >
                  Editar
                </Button>
              </div>
            ),
          } satisfies Column<SucursalApi>,
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sucursales"
        description="Casa matriz y locales del negocio"
        actions={
          puedeCrearEditar ? (
            <Button onClick={() => setDialogo({ tipo: 'crear' })}>
              <PlusIcon className="size-4" />
              Crear sucursal
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label htmlFor="sucursal-busqueda">Buscar</Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="sucursal-busqueda"
                className="pl-9"
                value={texto}
                placeholder="Nombre o dirección…"
                onChange={(evento) => setTexto(evento.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columnas}
        data={lista}
        isLoading={isLoading}
        error={error ? mensajeDeError(error, 'listar') : null}
        onRetry={() => void refetch()}
        getRowId={(sucursal) => sucursal.id}
        emptyTitle="Sin sucursales"
        emptyDescription="No hay sucursales que coincidan con la búsqueda en tu alcance."
      />

      {(dialogo?.tipo === 'crear' || dialogo?.tipo === 'editar') && (
        <SucursalDialog
          sucursal={dialogo.tipo === 'editar' ? dialogo.sucursal : null}
          onClose={() => setDialogo(null)}
        />
      )}
    </div>
  )
}
