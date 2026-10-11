// Pantalla del catálogo global de insumos.
//
// El catálogo es global: lo ven Admin y Gerente (`insumos.ver`) y solo lo edita
// el Admin (`insumos.catalogo.editar`). El stock por sucursal se gestiona en la
// pantalla de inventario.
import { useEffect, useMemo, useState } from 'react'
import { PencilIcon, PlusIcon, TrashIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import { InsumoDialog } from './InsumoDialog'
import { ETIQUETA_PRESENTACION, PRESENTACIONES_INSUMO } from './presentacion'
import { mensajeDeError } from './mensajes'
import { useEliminarInsumo, useInsumos } from './queries'
import type { InsumoApi, PresentacionInsumo } from '@/types/api'

const PAGE_SIZE = 20

export function InsumosPage() {
  const { permisos } = useAuth()
  const puedeEditar = tienePermiso(permisos, 'insumos.catalogo.editar')

  const [page, setPage] = useState(1)
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [presentacion, setPresentacion] = useState<PresentacionInsumo | 'todas'>(
    'todas',
  )
  const [dialogo, setDialogo] = useState<{ insumo: InsumoApi } | 'crear' | null>(
    null,
  )
  const [aEliminar, setAEliminar] = useState<InsumoApi | null>(null)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  useEffect(() => {
    const temporizador = setTimeout(() => {
      setQ(texto)
      setPage(1)
    }, 300)
    return () => clearTimeout(temporizador)
  }, [texto])

  const filtros = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(q.trim() !== '' ? { q: q.trim() } : {}),
      ...(presentacion !== 'todas' ? { presentacion } : {}),
    }),
    [page, q, presentacion],
  )

  const { data, isLoading, error, refetch } = useInsumos(filtros)
  const eliminar = useEliminarInsumo()

  const columnas: Column<InsumoApi>[] = [
    {
      key: 'nombre',
      header: 'Insumo',
      cell: (insumo) => <span className="font-medium">{insumo.nombre}</span>,
    },
    {
      key: 'presentacion',
      header: 'Presentación',
      cell: (insumo) => ETIQUETA_PRESENTACION[insumo.presentacion],
    },
    ...(puedeEditar
      ? [
          {
            key: 'acciones',
            header: '',
            className: 'text-right',
            cell: (insumo: InsumoApi) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDialogo({ insumo })}
                >
                  <PencilIcon className="size-4" />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setErrorEliminar(null)
                    setAEliminar(insumo)
                  }}
                >
                  <TrashIcon className="size-4" />
                  Eliminar
                </Button>
              </div>
            ),
          } satisfies Column<InsumoApi>,
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insumos"
        description="Catálogo global de insumos operativos y su presentación"
      />

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="insumo-busqueda">Buscar</Label>
            <Input
              id="insumo-busqueda"
              value={texto}
              placeholder="Nombre del insumo…"
              onChange={(evento) => setTexto(evento.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="insumo-filtro-presentacion">Presentación</Label>
            <Select
              value={presentacion}
              onValueChange={(valor) => {
                setPresentacion(valor as PresentacionInsumo | 'todas')
                setPage(1)
              }}
            >
              <SelectTrigger id="insumo-filtro-presentacion">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {PRESENTACIONES_INSUMO.map((valor) => (
                  <SelectItem key={valor} value={valor}>
                    {ETIQUETA_PRESENTACION[valor]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        {puedeEditar && (
          <Button onClick={() => setDialogo('crear')}>
            <PlusIcon className="size-4" />
            Nuevo insumo
          </Button>
        )}
      </div>

      <DataTable
        columns={columnas}
        data={data?.data ?? []}
        isLoading={isLoading}
        error={error ? mensajeDeError(error, 'insumos') : null}
        onRetry={() => void refetch()}
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.total}
        onPageChange={setPage}
        getRowId={(insumo) => insumo.id}
        emptyTitle="Sin insumos"
        emptyDescription="No hay insumos que coincidan con los filtros."
      />

      {dialogo !== null && (
        <InsumoDialog
          insumo={dialogo === 'crear' ? null : dialogo.insumo}
          onClose={() => setDialogo(null)}
        />
      )}

      {aEliminar && (
        <ConfirmDialog
          open
          onOpenChange={(abierto) => !abierto && setAEliminar(null)}
          title="Eliminar insumo"
          description={`¿Eliminar "${aEliminar.nombre}"? Solo se puede si no tiene stock en ninguna sucursal.`}
          confirmText="Eliminar"
          destructive
          loading={eliminar.isPending}
          onConfirm={() => {
            setErrorEliminar(null)
            eliminar.mutate(aEliminar.id, {
              onSuccess: () => {
                toast.success('Insumo eliminado')
                setAEliminar(null)
              },
              onError: (fallo) => setErrorEliminar(mensajeDeError(fallo, 'eliminar')),
            })
          }}
          onCancel={() => setAEliminar(null)}
        >
          {errorEliminar && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo eliminar</AlertTitle>
              <AlertDescription>{errorEliminar}</AlertDescription>
            </Alert>
          )}
        </ConfirmDialog>
      )}
    </div>
  )
}
