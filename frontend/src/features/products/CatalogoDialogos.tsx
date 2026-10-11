// Diálogos de alta y edición del catálogo global (productos, categorías y
// variantes). Cada diálogo se monta solo cuando está abierto, de modo que su
// estado interno se reinicia en cada apertura.
//
// La validación aquí es una ayuda: el backend sigue siendo la autoridad y sus
// errores (400/409) se muestran tal cual con `mensajeDeError`.
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
import {
  useActualizarCategoria,
  useActualizarProducto,
  useActualizarVariante,
  useCategorias,
  useCrearCategoria,
  useCrearProducto,
  useCrearVariante,
} from './queries'
import { mensajeDeError } from './mensajes'
import {
  LARGO_DESCRIPCION_PRODUCTO,
  LARGO_NOMBRE_CATEGORIA,
  LARGO_NOMBRE_PRODUCTO,
  LARGO_NOMBRE_VARIANTE,
  mensajeNombre,
} from './presentacion'
import type {
  CategoriaProductoApi,
  ProductoApi,
  VarianteApi,
} from '@/types/api'

function BotonesFormulario({
  pendiente,
  onCancelar,
  textoGuardar,
}: {
  pendiente: boolean
  onCancelar: () => void
  textoGuardar: string
}) {
  return (
    <DialogFooter>
      <Button variant="outline" onClick={onCancelar} disabled={pendiente}>
        Cancelar
      </Button>
      <Button type="submit" form="form-catalogo" disabled={pendiente}>
        {pendiente ? 'Guardando…' : textoGuardar}
      </Button>
    </DialogFooter>
  )
}

// ---------------------------------------------------------------- producto

interface ProductoDialogProps {
  producto?: ProductoApi | null
  onClose: () => void
}

export function ProductoDialog({ producto, onClose }: ProductoDialogProps) {
  const esEdicion = producto != null
  const [nombre, setNombre] = useState(producto?.nombre ?? '')
  const [categoriaId, setCategoriaId] = useState(producto?.categoriaId ?? '')
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '')
  const [error, setError] = useState<string | null>(null)

  const categorias = useCategorias()
  const crear = useCrearProducto()
  const actualizar = useActualizarProducto()
  const pendiente = crear.isPending || actualizar.isPending

  const descripcionLimpia = descripcion.trim()
  const valido =
    mensajeNombre(nombre, LARGO_NOMBRE_PRODUCTO) === null &&
    categoriaId !== '' &&
    descripcionLimpia.length <= LARGO_DESCRIPCION_PRODUCTO

  function guardar() {
    if (!valido) return
    setError(null)
    const entrada = {
      nombre: nombre.trim(),
      categoriaId,
      descripcion: descripcionLimpia === '' ? null : descripcionLimpia,
    }
    const opciones = {
      onSuccess: () => {
        toast.success(esEdicion ? 'Producto actualizado' : 'Producto creado')
        onClose()
      },
      onError: (fallo: unknown) =>
        setError(mensajeDeError(fallo, esEdicion ? 'editar' : 'crear')),
    }
    if (esEdicion && producto) {
      actualizar.mutate({ id: producto.id, entrada }, opciones)
    } else {
      crear.mutate(entrada, opciones)
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? 'Editar producto' : 'Nuevo producto'}
          </DialogTitle>
          <DialogDescription>
            El producto pertenece a una categoría del catálogo global.
          </DialogDescription>
        </DialogHeader>
        <form
          id="form-catalogo"
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            guardar()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="producto-nombre">Nombre</Label>
            <Input
              id="producto-nombre"
              value={nombre}
              maxLength={LARGO_NOMBRE_PRODUCTO.max}
              onChange={(evento) => setNombre(evento.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="producto-categoria">Categoría</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger id="producto-categoria">
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {(categorias.data ?? []).map((categoria) => (
                  <SelectItem key={categoria.id} value={categoria.id}>
                    {categoria.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categorias.data?.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Crea primero una categoría.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="producto-descripcion">
              Descripción (opcional)
            </Label>
            <Textarea
              id="producto-descripcion"
              value={descripcion}
              maxLength={LARGO_DESCRIPCION_PRODUCTO}
              onChange={(evento) => setDescripcion(evento.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground">
              {descripcion.length}/{LARGO_DESCRIPCION_PRODUCTO}
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo guardar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
        <BotonesFormulario
          pendiente={pendiente}
          onCancelar={onClose}
          textoGuardar={esEdicion ? 'Guardar cambios' : 'Crear producto'}
        />
      </DialogContent>
    </Dialog>
  )
}

// --------------------------------------------------------------- categoría

interface CategoriaDialogProps {
  categoria?: CategoriaProductoApi | null
  onClose: () => void
}

export function CategoriaDialog({
  categoria,
  onClose,
}: CategoriaDialogProps) {
  const esEdicion = categoria != null
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [error, setError] = useState<string | null>(null)

  const crear = useCrearCategoria()
  const actualizar = useActualizarCategoria()
  const pendiente = crear.isPending || actualizar.isPending
  const valido = mensajeNombre(nombre, LARGO_NOMBRE_CATEGORIA) === null

  function guardar() {
    if (!valido) return
    setError(null)
    const opciones = {
      onSuccess: () => {
        toast.success(esEdicion ? 'Categoría actualizada' : 'Categoría creada')
        onClose()
      },
      onError: (fallo: unknown) =>
        setError(mensajeDeError(fallo, esEdicion ? 'editar' : 'crear')),
    }
    if (esEdicion && categoria) {
      actualizar.mutate({ id: categoria.id, nombre: nombre.trim() }, opciones)
    } else {
      crear.mutate(nombre.trim(), opciones)
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? 'Editar categoría' : 'Nueva categoría'}
          </DialogTitle>
          <DialogDescription>
            Las categorías agrupan los productos del catálogo.
          </DialogDescription>
        </DialogHeader>
        <form
          id="form-catalogo"
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            guardar()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="categoria-nombre">Nombre</Label>
            <Input
              id="categoria-nombre"
              value={nombre}
              maxLength={LARGO_NOMBRE_CATEGORIA.max}
              onChange={(evento) => setNombre(evento.target.value)}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo guardar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
        <BotonesFormulario
          pendiente={pendiente}
          onCancelar={onClose}
          textoGuardar={esEdicion ? 'Guardar cambios' : 'Crear categoría'}
        />
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- variante

interface VarianteDialogProps {
  variante?: VarianteApi | null
  onClose: () => void
}

export function VarianteDialog({ variante, onClose }: VarianteDialogProps) {
  const esEdicion = variante != null
  const [nombre, setNombre] = useState(variante?.nombre ?? '')
  const [error, setError] = useState<string | null>(null)

  const crear = useCrearVariante()
  const actualizar = useActualizarVariante()
  const pendiente = crear.isPending || actualizar.isPending
  const valido = mensajeNombre(nombre, LARGO_NOMBRE_VARIANTE) === null

  function guardar() {
    if (!valido) return
    setError(null)
    const opciones = {
      onSuccess: () => {
        toast.success(esEdicion ? 'Variante actualizada' : 'Variante creada')
        onClose()
      },
      onError: (fallo: unknown) =>
        setError(mensajeDeError(fallo, esEdicion ? 'editar' : 'crear')),
    }
    if (esEdicion && variante) {
      actualizar.mutate({ id: variante.id, nombre: nombre.trim() }, opciones)
    } else {
      crear.mutate(nombre.trim(), opciones)
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? 'Editar variante' : 'Nueva variante'}
          </DialogTitle>
          <DialogDescription>
            Las variantes (tamaño, presentación) se combinan con cada producto.
          </DialogDescription>
        </DialogHeader>
        <form
          id="form-catalogo"
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            guardar()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="variante-nombre">Nombre</Label>
            <Input
              id="variante-nombre"
              value={nombre}
              maxLength={LARGO_NOMBRE_VARIANTE.max}
              onChange={(evento) => setNombre(evento.target.value)}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo guardar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
        <BotonesFormulario
          pendiente={pendiente}
          onCancelar={onClose}
          textoGuardar={esEdicion ? 'Guardar cambios' : 'Crear variante'}
        />
      </DialogContent>
    </Dialog>
  )
}
