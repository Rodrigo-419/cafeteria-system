import { useMemo, useState } from 'react'
import {
  CheckCircle2Icon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  ShoppingCartIcon,
  Trash2Icon,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { MoneyText } from '@/components/shared/MoneyText'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import { formatearFechaHora } from '@/lib/format/dates'
import type {
  CartaOferta,
  MetodoPagoVenta,
  VentaCompletaApi,
} from '@/types/api'
import { mensajeDeError } from './mensajes'
import { ETIQUETA_METODO, precioEnCentimos } from './presentacion'
import { useCarta, useRegistrarVenta } from './queries'

const MAX_CANTIDAD = 9999
const MAX_LINEAS = 100

interface LineaCarrito {
  ofertaId: string
  nombreProducto: string
  nombreVariante: string
  precioCentimos: number
  cantidad: number
}

const sinAcentos = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

function ConfirmacionVenta({
  venta,
  onNueva,
}: {
  venta: VentaCompletaApi
  onNueva: () => void
}) {
  return (
    <Card role="status" aria-live="polite">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2Icon className="size-5 text-success" />
          Venta registrada
        </CardTitle>
        <CardDescription>
          {formatearFechaHora(venta.createdAt)} · {venta.sucursal.nombre} ·
          atendió {venta.vendedor.nombre}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
          <span className="text-muted-foreground">
            Folio: <span className="text-foreground">{venta.id}</span>
          </span>
          <span className="text-muted-foreground">
            Pago: <span className="text-foreground">{ETIQUETA_METODO[venta.metodoPago]}</span>
          </span>
        </div>
        <div className="border-t">
          {venta.detalles.map((detalle) => {
            const subtotal = precioEnCentimos(detalle.subtotal) ?? 0
            return (
              <div
                key={detalle.id}
                className="flex items-center justify-between border-b py-2 text-sm"
              >
                <span>
                  {detalle.cantidad} × {detalle.producto.nombre}{' '}
                  <span className="text-muted-foreground">
                    ({detalle.variante.nombre})
                  </span>
                </span>
                <MoneyText amountCents={subtotal} />
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-between text-base font-semibold">
          <span>Total</span>
          <MoneyText amountCents={precioEnCentimos(venta.total) ?? 0} />
        </div>
        <Button variant="secondary" onClick={onNueva}>
          Registrar otra venta
        </Button>
      </CardContent>
    </Card>
  )
}

export function NewSalePage() {
  const { usuario, permisos } = useAuth()
  const sucursalId = usuario?.sucursalId ?? null
  const puedeVerCarta = tienePermiso(permisos, 'productos.ver')
  const puedeRegistrar = tienePermiso(permisos, 'ventas.registrar')

  const { data: carta, isLoading, error, refetch } = useCarta(sucursalId)
  const registrar = useRegistrarVenta()

  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('todas')
  const [metodoPago, setMetodoPago] = useState<MetodoPagoVenta>('efectivo')
  const [lineas, setLineas] = useState<LineaCarrito[]>([])
  const [ventaRegistrada, setVentaRegistrada] = useState<VentaCompletaApi | null>(
    null,
  )

  const ofertasActivas = useMemo(
    () => (carta ?? []).filter((oferta) => oferta.estado === 'activo'),
    [carta],
  )

  const categorias = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const oferta of ofertasActivas) {
      mapa.set(oferta.producto.categoriaId, oferta.producto.categoria.nombre)
    }
    return [...mapa.entries()].map(([id, nombre]) => ({ id, nombre }))
  }, [ofertasActivas])

  const ofertasFiltradas = useMemo(() => {
    const termino = sinAcentos(busqueda.trim())
    return ofertasActivas.filter((oferta) => {
      if (categoria !== 'todas' && oferta.producto.categoriaId !== categoria) {
        return false
      }
      if (termino.length === 0) {
        return true
      }
      const texto = sinAcentos(
        `${oferta.producto.nombre} ${oferta.variante.nombre} ${oferta.producto.categoria.nombre}`,
      )
      return texto.includes(termino)
    })
  }, [ofertasActivas, busqueda, categoria])

  const ofertasPorCategoria = useMemo(() => {
    const mapa = new Map<string, { nombre: string; ofertas: CartaOferta[] }>()
    for (const oferta of ofertasFiltradas) {
      const clave = oferta.producto.categoriaId
      const entrada = mapa.get(clave) ?? {
        nombre: oferta.producto.categoria.nombre,
        ofertas: [],
      }
      entrada.ofertas.push(oferta)
      mapa.set(clave, entrada)
    }
    return [...mapa.values()]
  }, [ofertasFiltradas])

  const totalCentimos = lineas.reduce(
    (acumulado, linea) => acumulado + linea.precioCentimos * linea.cantidad,
    0,
  )

  const carritoValido =
    lineas.length >= 1 &&
    lineas.length <= MAX_LINEAS &&
    lineas.every(
      (linea) => linea.cantidad >= 1 && linea.cantidad <= MAX_CANTIDAD,
    )

  function agregar(oferta: CartaOferta) {
    const precio = precioEnCentimos(oferta.precio)
    if (precio === null) {
      return
    }
    setLineas((actuales) => {
      const existente = actuales.find((linea) => linea.ofertaId === oferta.id)
      if (existente) {
        return actuales.map((linea) =>
          linea.ofertaId === oferta.id
            ? { ...linea, cantidad: Math.min(MAX_CANTIDAD, linea.cantidad + 1) }
            : linea,
        )
      }
      if (actuales.length >= MAX_LINEAS) {
        return actuales
      }
      return [
        ...actuales,
        {
          ofertaId: oferta.id,
          nombreProducto: oferta.producto.nombre,
          nombreVariante: oferta.variante.nombre,
          precioCentimos: precio,
          cantidad: 1,
        },
      ]
    })
  }

  function cambiarCantidad(ofertaId: string, cantidad: number) {
    const acotada = Math.min(MAX_CANTIDAD, Math.max(1, Math.trunc(cantidad)))
    setLineas((actuales) =>
      actuales.map((linea) =>
        linea.ofertaId === ofertaId ? { ...linea, cantidad: acotada } : linea,
      ),
    )
  }

  function quitar(ofertaId: string) {
    setLineas((actuales) =>
      actuales.filter((linea) => linea.ofertaId !== ofertaId),
    )
  }

  function onRegistrar() {
    registrar.mutate(
      {
        metodoPago,
        items: lineas.map((linea) => ({
          productoSucursalVarianteId: linea.ofertaId,
          cantidad: linea.cantidad,
        })),
      },
      {
        onSuccess: (venta) => {
          setVentaRegistrada(venta)
          setLineas([])
        },
      },
    )
  }

  if (ventaRegistrada) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Nueva venta"
          description="Venta registrada en la sucursal"
        />
        <ConfirmacionVenta
          venta={ventaRegistrada}
          onNueva={() => setVentaRegistrada(null)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva venta"
        description={
          usuario?.sucursalId
            ? 'Carta de tu sucursal'
            : 'Venta en mostrador'
        }
      />

      {!puedeRegistrar && (
        <Alert variant="destructive">
          <AlertTitle>Sin permiso</AlertTitle>
          <AlertDescription>
            No tienes permiso para registrar ventas.
          </AlertDescription>
        </Alert>
      )}

      {sucursalId === null ? (
        <ErrorState
          title="Sin sucursal asignada"
          description="Solo un usuario con sucursal puede registrar ventas."
        />
      ) : !puedeVerCarta ? (
        <ErrorState
          title="No puedes ver la carta"
          description="Necesitas permiso para ver la carta de productos."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="space-y-4">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar producto o categoría…"
                aria-label="Buscar en la carta"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
              />
            </div>

            {categorias.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={categoria === 'todas' ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setCategoria('todas')}
                >
                  Todas
                </Button>
                {categorias.map((item) => (
                  <Button
                    key={item.id}
                    variant={categoria === item.id ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => setCategoria(item.id)}
                  >
                    {item.nombre}
                  </Button>
                ))}
              </div>
            )}

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : error ? (
              <ErrorState
                title="No se pudo cargar la carta"
                description={mensajeDeError(error, 'carta')}
                onRetry={() => void refetch()}
              />
            ) : ofertasPorCategoria.length === 0 ? (
              <EmptyState
                title="Sin resultados"
                description="No hay ofertas que coincidan con la búsqueda."
              />
            ) : (
              <div className="space-y-6">
                {ofertasPorCategoria.map((grupo) => (
                  <div key={grupo.nombre} className="space-y-2">
                    <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                      {grupo.nombre}
                    </h2>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {grupo.ofertas.map((oferta) => {
                        const precio = precioEnCentimos(oferta.precio)
                        return (
                          <Card key={oferta.id} className="p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {oferta.producto.nombre}
                                </p>
                                <p className="truncate text-sm text-muted-foreground">
                                  {oferta.variante.nombre}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="text-sm font-medium">
                                  {precio !== null && (
                                    <MoneyText amountCents={precio} />
                                  )}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  aria-label={`Agregar ${oferta.producto.nombre}`}
                                  onClick={() => agregar(oferta)}
                                >
                                  <PlusIcon className="size-4" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <Card className="lg:sticky lg:top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCartIcon className="size-5" />
                  Orden activa
                </CardTitle>
                <CardDescription>
                  {lineas.length} {lineas.length === 1 ? 'línea' : 'líneas'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {lineas.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Agrega productos para iniciar la venta.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {lineas.map((linea) => (
                      <div key={linea.ofertaId} className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {linea.nombreProducto}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {linea.nombreVariante}
                            </p>
                          </div>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Quitar ${linea.nombreProducto}`}
                            onClick={() => quitar(linea.ofertaId)}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon-sm"
                              variant="outline"
                              aria-label={`Disminuir ${linea.nombreProducto}`}
                              onClick={() =>
                                cambiarCantidad(
                                  linea.ofertaId,
                                  linea.cantidad - 1,
                                )
                              }
                            >
                              <MinusIcon className="size-3" />
                            </Button>
                            <Input
                              className="h-8 w-14 text-center"
                              inputMode="numeric"
                              aria-label={`Cantidad de ${linea.nombreProducto}`}
                              value={linea.cantidad}
                              onChange={(evento) =>
                                cambiarCantidad(
                                  linea.ofertaId,
                                  Number(evento.target.value),
                                )
                              }
                            />
                            <Button
                              size="icon-sm"
                              variant="outline"
                              aria-label={`Aumentar ${linea.nombreProducto}`}
                              onClick={() =>
                                cambiarCantidad(
                                  linea.ofertaId,
                                  linea.cantidad + 1,
                                )
                              }
                            >
                              <PlusIcon className="size-3" />
                            </Button>
                          </div>
                          <MoneyText
                            amountCents={
                              linea.precioCentimos * linea.cantidad
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t" />

                <div className="flex items-center justify-between text-base font-semibold">
                  <span>Total</span>
                  <MoneyText amountCents={totalCentimos} />
                </div>
                <p className="text-xs text-muted-foreground">
                  El total final se calcula con los precios vigentes al registrar
                  la venta.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="metodo-pago">Método de pago</Label>
                  <Select
                    value={metodoPago}
                    onValueChange={(valor) =>
                      setMetodoPago(valor as MetodoPagoVenta)
                    }
                  >
                    <SelectTrigger id="metodo-pago" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">
                        {ETIQUETA_METODO.efectivo}
                      </SelectItem>
                      <SelectItem value="tarjeta">
                        {ETIQUETA_METODO.tarjeta}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {registrar.isError && (
                  <Alert variant="destructive">
                    <AlertTitle>No se pudo registrar</AlertTitle>
                    <AlertDescription>
                      {mensajeDeError(registrar.error, 'registrar')}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  className="w-full"
                  disabled={
                    !puedeRegistrar || !carritoValido || registrar.isPending
                  }
                  onClick={onRegistrar}
                >
                  {registrar.isPending ? 'Registrando…' : 'Registrar venta'}
                </Button>
                {lineas.length > 0 && (
                  <Badge variant="outline">
                    {lineas.length} de {MAX_LINEAS} líneas máx.
                  </Badge>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </div>
  )
}
