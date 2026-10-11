// Sección "Catálogo" de la pantalla de productos: gestión del catálogo global
// (productos, categorías y variantes). Todo es de alcance del Admin por el
// permiso `productos.catalogo.editar`; el backend valida igualmente cada acción.
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import {
  CategoriaDialog,
  ProductoDialog,
  VarianteDialog,
} from './CatalogoDialogos'
import { esVarianteBase } from './presentacion'
import { mensajeDeError } from './mensajes'
import {
  useCategorias,
  useEliminarCategoria,
  useEliminarProducto,
  useEliminarVariante,
  useProductos,
  useVariantes,
} from './queries'
import type {
  CategoriaProductoApi,
  ProductoApi,
  VarianteApi,
} from '@/types/api'

const PAGE_SIZE = 20

/** Confirmación de borrado reutilizable con el mensaje de error del servidor. */
function DialogoEliminar({
  titulo,
  descripcion,
  error,
  pendiente,
  onCerrar,
  onConfirmar,
}: {
  titulo: string
  descripcion: string
  error: string | null
  pendiente: boolean
  onCerrar: () => void
  onConfirmar: () => void
}) {
  return (
    <ConfirmDialog
      open
      onOpenChange={(abierto) => !abierto && onCerrar()}
      title={titulo}
      description={descripcion}
      confirmText="Eliminar"
      destructive
      loading={pendiente}
      onConfirm={onConfirmar}
      onCancel={onCerrar}
    >
      {error && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo eliminar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </ConfirmDialog>
  )
}

// ------------------------------------------------------------- productos

function ListadoProductos({ puedeEditar }: { puedeEditar: boolean }) {
  const [page, setPage] = useState(1)
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [categoriaId, setCategoriaId] = useState('todas')
  const [dialogoProducto, setDialogoProducto] = useState<
    { producto: ProductoApi } | 'crear' | null
  >(null)
  const [productoAEliminar, setProductoAEliminar] =
    useState<ProductoApi | null>(null)
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
      ...(categoriaId !== 'todas' ? { categoriaId } : {}),
    }),
    [page, q, categoriaId],
  )

  const categorias = useCategorias()
  const { data, isLoading, error, refetch } = useProductos(filtros)
  const eliminar = useEliminarProducto()

  const columnas: Column<ProductoApi>[] = [
    {
      key: 'nombre',
      header: 'Producto',
      cell: (producto) => (
        <span className="font-medium">{producto.nombre}</span>
      ),
    },
    {
      key: 'categoria',
      header: 'Categoría',
      cell: (producto) => producto.categoria.nombre,
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      cell: (producto) => (
        <span className="text-muted-foreground">
          {producto.descripcion ?? '—'}
        </span>
      ),
    },
    ...(puedeEditar
      ? [
          {
            key: 'acciones',
            header: '',
            className: 'text-right',
            cell: (producto: ProductoApi) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDialogoProducto({ producto })}
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
                    setProductoAEliminar(producto)
                  }}
                >
                  <TrashIcon className="size-4" />
                  Eliminar
                </Button>
              </div>
            ),
          } satisfies Column<ProductoApi>,
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="producto-busqueda">Buscar</Label>
            <Input
              id="producto-busqueda"
              value={texto}
              placeholder="Nombre del producto…"
              onChange={(evento) => setTexto(evento.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="producto-filtro-categoria">Categoría</Label>
            <Select
              value={categoriaId}
              onValueChange={(valor) => {
                setCategoriaId(valor)
                setPage(1)
              }}
            >
              <SelectTrigger id="producto-filtro-categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {(categorias.data ?? []).map((categoria) => (
                  <SelectItem key={categoria.id} value={categoria.id}>
                    {categoria.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        {puedeEditar && (
          <Button onClick={() => setDialogoProducto('crear')}>
            <PlusIcon className="size-4" />
            Nuevo producto
          </Button>
        )}
      </div>

      <DataTable
        columns={columnas}
        data={data?.data ?? []}
        isLoading={isLoading}
        error={error ? mensajeDeError(error, 'catalogo') : null}
        onRetry={() => void refetch()}
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.total}
        onPageChange={setPage}
        getRowId={(producto) => producto.id}
        emptyTitle="Sin productos"
        emptyDescription="No hay productos que coincidan con los filtros."
      />

      {dialogoProducto !== null && (
        <ProductoDialog
          producto={
            dialogoProducto === 'crear' ? null : dialogoProducto.producto
          }
          onClose={() => setDialogoProducto(null)}
        />
      )}

      {productoAEliminar && (
        <DialogoEliminar
          titulo="Eliminar producto"
          descripcion={`¿Eliminar "${productoAEliminar.nombre}"? No se puede deshacer.`}
          error={errorEliminar}
          pendiente={eliminar.isPending}
          onCerrar={() => setProductoAEliminar(null)}
          onConfirmar={() => {
            setErrorEliminar(null)
            eliminar.mutate(productoAEliminar.id, {
              onSuccess: () => {
                toast.success('Producto eliminado')
                setProductoAEliminar(null)
              },
              onError: (fallo) =>
                setErrorEliminar(mensajeDeError(fallo, 'eliminar')),
            })
          }}
        />
      )}
    </div>
  )
}

// ------------------------------------------------------------ categorías

function ListadoCategorias({ puedeEditar }: { puedeEditar: boolean }) {
  const [dialogo, setDialogo] = useState<
    { categoria: CategoriaProductoApi } | 'crear' | null
  >(null)
  const [aEliminar, setAEliminar] = useState<CategoriaProductoApi | null>(null)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useCategorias()
  const eliminar = useEliminarCategoria()

  const columnas: Column<CategoriaProductoApi>[] = [
    {
      key: 'nombre',
      header: 'Categoría',
      cell: (categoria) => (
        <span className="font-medium">{categoria.nombre}</span>
      ),
    },
    ...(puedeEditar
      ? [
          {
            key: 'acciones',
            header: '',
            className: 'text-right',
            cell: (categoria: CategoriaProductoApi) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDialogo({ categoria })}
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
                    setAEliminar(categoria)
                  }}
                >
                  <TrashIcon className="size-4" />
                  Eliminar
                </Button>
              </div>
            ),
          } satisfies Column<CategoriaProductoApi>,
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {puedeEditar && (
          <Button onClick={() => setDialogo('crear')}>
            <PlusIcon className="size-4" />
            Nueva categoría
          </Button>
        )}
      </div>

      <DataTable
        columns={columnas}
        data={data ?? []}
        isLoading={isLoading}
        error={error ? mensajeDeError(error, 'catalogo') : null}
        onRetry={() => void refetch()}
        getRowId={(categoria) => categoria.id}
        emptyTitle="Sin categorías"
        emptyDescription="Crea una categoría para agrupar productos."
      />

      {dialogo !== null && (
        <CategoriaDialog
          categoria={dialogo === 'crear' ? null : dialogo.categoria}
          onClose={() => setDialogo(null)}
        />
      )}

      {aEliminar && (
        <DialogoEliminar
          titulo="Eliminar categoría"
          descripcion={`¿Eliminar "${aEliminar.nombre}"? Solo se puede si no tiene productos.`}
          error={errorEliminar}
          pendiente={eliminar.isPending}
          onCerrar={() => setAEliminar(null)}
          onConfirmar={() => {
            setErrorEliminar(null)
            eliminar.mutate(aEliminar.id, {
              onSuccess: () => {
                toast.success('Categoría eliminada')
                setAEliminar(null)
              },
              onError: (fallo) =>
                setErrorEliminar(mensajeDeError(fallo, 'eliminar')),
            })
          }}
        />
      )}
    </div>
  )
}

// -------------------------------------------------------------- variantes

function ListadoVariantes({ puedeEditar }: { puedeEditar: boolean }) {
  const [dialogo, setDialogo] = useState<
    { variante: VarianteApi } | 'crear' | null
  >(null)
  const [aEliminar, setAEliminar] = useState<VarianteApi | null>(null)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useVariantes()
  const eliminar = useEliminarVariante()

  const columnas: Column<VarianteApi>[] = [
    {
      key: 'nombre',
      header: 'Variante',
      cell: (variante) => (
        <span className="font-medium">{variante.nombre}</span>
      ),
    },
    ...(puedeEditar
      ? [
          {
            key: 'acciones',
            header: '',
            className: 'text-right',
            cell: (variante: VarianteApi) =>
              esVarianteBase(variante.nombre) ? (
                <span className="text-xs text-muted-foreground">
                  Variante base
                </span>
              ) : (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDialogo({ variante })}
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
                      setAEliminar(variante)
                    }}
                  >
                    <TrashIcon className="size-4" />
                    Eliminar
                  </Button>
                </div>
              ),
          } satisfies Column<VarianteApi>,
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {puedeEditar && (
          <Button onClick={() => setDialogo('crear')}>
            <PlusIcon className="size-4" />
            Nueva variante
          </Button>
        )}
      </div>

      <DataTable
        columns={columnas}
        data={data ?? []}
        isLoading={isLoading}
        error={error ? mensajeDeError(error, 'catalogo') : null}
        onRetry={() => void refetch()}
        getRowId={(variante) => variante.id}
        emptyTitle="Sin variantes"
        emptyDescription="Crea variantes (tamaño, presentación) para los productos."
      />

      {dialogo !== null && (
        <VarianteDialog
          variante={dialogo === 'crear' ? null : dialogo.variante}
          onClose={() => setDialogo(null)}
        />
      )}

      {aEliminar && (
        <DialogoEliminar
          titulo="Eliminar variante"
          descripcion={`¿Eliminar "${aEliminar.nombre}"? Solo se puede si no tiene precios.`}
          error={errorEliminar}
          pendiente={eliminar.isPending}
          onCerrar={() => setAEliminar(null)}
          onConfirmar={() => {
            setErrorEliminar(null)
            eliminar.mutate(aEliminar.id, {
              onSuccess: () => {
                toast.success('Variante eliminada')
                setAEliminar(null)
              },
              onError: (fallo) =>
                setErrorEliminar(mensajeDeError(fallo, 'eliminar')),
            })
          }}
        />
      )}
    </div>
  )
}

export function CatalogoSeccion() {
  const { permisos } = useAuth()
  const puedeEditar = tienePermiso(permisos, 'productos.catalogo.editar')

  return (
    <Tabs defaultValue="productos" className="space-y-4">
      <TabsList>
        <TabsTrigger value="productos">Productos</TabsTrigger>
        <TabsTrigger value="categorias">Categorías</TabsTrigger>
        <TabsTrigger value="variantes">Variantes</TabsTrigger>
      </TabsList>

      <TabsContent value="productos">
        <ListadoProductos puedeEditar={puedeEditar} />
      </TabsContent>
      <TabsContent value="categorias">
        <ListadoCategorias puedeEditar={puedeEditar} />
      </TabsContent>
      <TabsContent value="variantes">
        <ListadoVariantes puedeEditar={puedeEditar} />
      </TabsContent>
    </Tabs>
  )
}
