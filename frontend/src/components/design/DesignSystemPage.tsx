import { useState } from 'react'
import { toast } from 'sonner'
import { BanknoteIcon, SearchIcon, WrenchIcon } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { MoneyText } from '@/components/shared/MoneyText'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { StatCard } from '@/components/shared/StatCard'
import { StatusPill } from '@/components/shared/StatusPill'
import { EstadoOfertaBadge } from '@/features/products/EstadoOfertaBadge'
import { EstadoEquipoBadge } from '@/features/equipment/EstadoEquipoBadge'
import { EstadoStockBadge } from '@/features/inventory/EstadoStockBadge'
import { EstadoUsuarioBadge } from '@/features/users/EstadoUsuarioBadge'
import { NivelStock } from '@/features/inventory/NivelStock'
import { VariacionStock } from '@/features/inventory/VariacionStock'
import { PasswordReveal } from '@/components/shared/PasswordReveal'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from 'cn'

interface Item {
  id: string
  name: string
  price: number
}

const ESCALAS: { nombre: string; clases: string[] }[] = [
  {
    nombre: 'primary',
    clases: [
      'bg-primary-50',
      'bg-primary-100',
      'bg-primary-200',
      'bg-primary-300',
      'bg-primary-400',
      'bg-primary-500',
      'bg-primary-600',
      'bg-primary-700',
      'bg-primary-800',
      'bg-primary-900',
    ],
  },
  {
    nombre: 'secondary',
    clases: [
      'bg-secondary-50',
      'bg-secondary-100',
      'bg-secondary-200',
      'bg-secondary-300',
      'bg-secondary-400',
      'bg-secondary-500',
      'bg-secondary-600',
      'bg-secondary-700',
      'bg-secondary-800',
      'bg-secondary-900',
    ],
  },
  {
    nombre: 'tertiary',
    clases: [
      'bg-tertiary-50',
      'bg-tertiary-100',
      'bg-tertiary-200',
      'bg-tertiary-300',
      'bg-tertiary-400',
      'bg-tertiary-500',
      'bg-tertiary-600',
      'bg-tertiary-700',
      'bg-tertiary-800',
      'bg-tertiary-900',
    ],
  },
  {
    nombre: 'neutral',
    clases: [
      'bg-neutral-50',
      'bg-neutral-100',
      'bg-neutral-200',
      'bg-neutral-300',
      'bg-neutral-400',
      'bg-neutral-500',
      'bg-neutral-600',
      'bg-neutral-700',
      'bg-neutral-800',
      'bg-neutral-900',
    ],
  },
  {
    nombre: 'success',
    clases: [
      'bg-success-50',
      'bg-success-100',
      'bg-success-200',
      'bg-success-300',
      'bg-success-400',
      'bg-success-500',
      'bg-success-600',
      'bg-success-700',
      'bg-success-800',
      'bg-success-900',
    ],
  },
  {
    nombre: 'warning',
    clases: [
      'bg-warning-50',
      'bg-warning-100',
      'bg-warning-200',
      'bg-warning-300',
      'bg-warning-400',
      'bg-warning-500',
      'bg-warning-600',
      'bg-warning-700',
      'bg-warning-800',
      'bg-warning-900',
    ],
  },
  {
    nombre: 'error',
    clases: [
      'bg-error-50',
      'bg-error-100',
      'bg-error-200',
      'bg-error-300',
      'bg-error-400',
      'bg-error-500',
      'bg-error-600',
      'bg-error-700',
      'bg-error-800',
      'bg-error-900',
    ],
  },
  {
    nombre: 'info',
    clases: [
      'bg-info-50',
      'bg-info-100',
      'bg-info-200',
      'bg-info-300',
      'bg-info-400',
      'bg-info-500',
      'bg-info-600',
      'bg-info-700',
      'bg-info-800',
      'bg-info-900',
    ],
  },
]

const PASOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]

function SeccionEscalas() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Escalas de color</CardTitle>
        <CardDescription>
          Tonos 50–900 derivados de cada color base. Todo se consume como token;
          ningún hex suelto en el código.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ESCALAS.map((escala) => (
          <div key={escala.nombre} className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {escala.nombre}
            </p>
            <div className="flex overflow-hidden rounded-lg border border-border">
              {escala.clases.map((clase, i) => (
                <div
                  key={clase}
                  title={`${escala.nombre}-${PASOS[i]}`}
                  className={cn('h-12 flex-1', clase)}
                />
              ))}
            </div>
            <div className="flex text-[10px] text-muted-foreground">
              {PASOS.map((paso) => (
                <span key={paso} className="flex-1 text-center">
                  {paso}
                </span>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function SeccionTipografia() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tipografía</CardTitle>
        <CardDescription>
          Plus Jakarta Sans (self-hosted vía @fontsource-variable).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">Título · font-sans font-bold</p>
          <p className="text-3xl font-bold tracking-tight">
            Café de especialidad
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Cuerpo · font-sans font-normal</p>
          <p className="text-base">
            Sistemas de cafetería: operaciones, inventario y ventas en un solo
            lugar.
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            Etiqueta · font-sans font-medium uppercase tracking-wide
          </p>
          <p className="text-xs font-medium tracking-wide uppercase">
            Etiqueta de campo
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function SeccionBotones() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Botones</CardTitle>
        <CardDescription>
          Primary, Secondary, Inverted, Outlined y Destructive (rojo distinto de
          los cafés).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="inverted">Inverted</Button>
        <Button variant="outline">Outlined</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
        <Button disabled>Deshabilitado</Button>
      </CardContent>
    </Card>
  )
}

function SeccionBusquedaYNav() {
  const items = ['Inicio', 'Productos', 'Inventario', 'Reportes']
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Campo de búsqueda</CardTitle>
          <CardDescription>Fondo crema y borde sutil.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar productos…" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Navegación</CardTitle>
          <CardDescription>Estado activo con círculo primario.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {items.map((item, i) => {
            const activo = i === 1
            return (
              <div
                key={item}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
                  activo
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-foreground',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-2 rounded-full',
                    activo ? 'bg-primary' : 'bg-muted-foreground/40',
                  )}
                />
                {item}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

function SeccionBadges() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Badges de estado</CardTitle>
        <CardDescription>
          Success, Warning, Info, Error y neutros. Semánticos independientes de la
          marca.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="info">Info</Badge>
        <Badge variant="destructive">Error</Badge>
        <Badge variant="outline">Outline</Badge>
      </CardContent>
    </Card>
  )
}

function SeccionToasts() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Toasts</CardTitle>
        <CardDescription>Avisos con tokens semánticos.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => toast('Venta registrada')}>
          Neutral
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.success('Producto actualizado')}
        >
          Success
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.warning('Stock por debajo del mínimo')}
        >
          Warning
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.info('Recuento pendiente')}
        >
          Info
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.error('No se pudo anular la venta')}
        >
          Error
        </Button>
      </CardContent>
    </Card>
  )
}

export function DesignSystemPage() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmConMotivo, setConfirmConMotivo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const columns: Column<Item>[] = [
    { key: 'name', header: 'Nombre', cell: (i) => i.name },
    {
      key: 'price',
      header: 'Precio',
      cell: (i) => <MoneyText amountCents={i.price} />,
    },
    {
      key: 'estado',
      header: 'Estado',
      cell: () => <Badge variant="success">Activo</Badge>,
    },
  ]
  const data: Item[] = [
    { id: '1', name: 'Café', price: 500 },
    { id: '2', name: 'Té', price: 400 },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sistema de diseño · Artisan Ops"
        description="Catálogo de tokens y componentes (solo desarrollo)"
      />
      <Tabs defaultValue="fundamentos">
        <TabsList>
          <TabsTrigger value="fundamentos">Fundamentos</TabsTrigger>
          <TabsTrigger value="componentes">Componentes</TabsTrigger>
          <TabsTrigger value="formularios">Formularios</TabsTrigger>
          <TabsTrigger value="datos">Datos</TabsTrigger>
        </TabsList>

        <TabsContent value="fundamentos" className="space-y-4">
          <SeccionEscalas />
          <SeccionTipografia />
          <SeccionBotones />
          <SeccionBusquedaYNav />
          <SeccionBadges />
          <SeccionToasts />
        </TabsContent>

        <TabsContent value="componentes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dropdown, Dialog y AlertDialog</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Menú</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Acción 1</DropdownMenuItem>
                  <DropdownMenuItem>Acción 2</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Abrir Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Dialog</DialogTitle>
                    <DialogDescription>Contenido del diálogo.</DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">AlertDialog</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Confirmar?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Acción con confirmación.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction>Aceptar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="outline" onClick={() => setConfirmOpen(true)}>
                ConfirmDialog (controlado)
              </Button>
              <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Eliminar elemento"
                description="¿Deseas continuar?"
                confirmText="Eliminar"
                destructive
                onConfirm={() => setConfirmOpen(false)}
              />
              <Button variant="outline" onClick={() => setConfirmConMotivo(true)}>
                ConfirmDialog con motivo
              </Button>
              <ConfirmDialog
                open={confirmConMotivo}
                onOpenChange={(abierto) => {
                  setConfirmConMotivo(abierto)
                  if (!abierto) setMotivo('')
                }}
                title="Anular venta"
                description="Se requiere un motivo para la acción."
                confirmText="Confirmar"
                confirmDisabled={motivo.trim().length === 0}
                onConfirm={() => setConfirmConMotivo(false)}
              >
                <div className="space-y-2">
                  <Label htmlFor="ds-motivo">Motivo</Label>
                  <Textarea
                    id="ds-motivo"
                    value={motivo}
                    maxLength={200}
                    onChange={(evento) => setMotivo(evento.target.value)}
                  />
                  <p className="text-right text-xs text-muted-foreground">
                    {motivo.length}/200
                  </p>
                </div>
              </ConfirmDialog>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cargas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Métricas y estados</CardTitle>
              <CardDescription>
                StatCard para KPIs y StatusPill para estados con punto de color.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard
                  title="Ventas de hoy"
                  icon={BanknoteIcon}
                  value={<MoneyText amountCents={125000} />}
                  hint="18 ventas completadas"
                />
                <StatCard
                  title="Anuladas hoy"
                  icon={WrenchIcon}
                  value={2}
                  tone="warning"
                  hint="Ventas anuladas del día"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tono="success">Funcionando</StatusPill>
                <StatusPill tono="warning">En mantenimiento</StatusPill>
                <StatusPill tono="error">Dañado</StatusPill>
                <StatusPill tono="info">Nuevo</StatusPill>
                <StatusPill>Retirado</StatusPill>
                <EstadoOfertaBadge estado="activo" />
                <EstadoOfertaBadge estado="inactivo" />
                <EstadoEquipoBadge estado="funcionando" />
                <EstadoEquipoBadge estado="en_mantenimiento" />
                <EstadoEquipoBadge estado="danado" />
                <EstadoEquipoBadge estado="retirado" />
                <EstadoUsuarioBadge estado="activo" />
                <EstadoUsuarioBadge estado="bloqueado" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Nivel de stock</CardTitle>
              <CardDescription>
                Estado del insumo en la sucursal y barra proporcional al mínimo
                (cuantizada a pasos de 5%).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <EstadoStockBadge estado="activo" />
                <EstadoStockBadge estado="descontinuado" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <NivelStock stock="12.50" minimo="5.00" estado="activo" />
                <NivelStock stock="4.00" minimo="5.00" estado="activo" />
                <NivelStock stock="5.00" minimo="5.00" estado="activo" />
                <NivelStock stock="0.00" minimo="5.00" estado="descontinuado" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Variación de stock</CardTitle>
              <CardDescription>
                Movimientos y diferencias de recuento: signo, color y palabra,
                para no depender solo del color.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-6">
              <VariacionStock cantidad="10.00" />
              <VariacionStock cantidad="-1.50" />
              <VariacionStock cantidad="0.00" />
              <VariacionStock cantidad="-2.00" conEtiqueta={false} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="formularios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Formularios</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ds-input">Input</Label>
                <Input id="ds-input" placeholder="Escribe…" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-select">Select</Label>
                <Select>
                  <SelectTrigger id="ds-select">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Opción 1</SelectItem>
                    <SelectItem value="2">Opción 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-textarea">Textarea</Label>
                <Textarea id="ds-textarea" placeholder="Texto largo…" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="ds-check" />
                <Label htmlFor="ds-check">Checkbox</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-password">Contraseña temporal (solo lectura + copiar)</Label>
                <PasswordReveal id="ds-password" valor="S3creta!DeMuestra2026" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="datos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tabla</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.name}</TableCell>
                      <TableCell>
                        <MoneyText amountCents={d.price} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="success">Activo</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>DataTable</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DataTable columns={columns} data={data} />
              <DataTable
                columns={columns}
                data={data}
                getRowId={(item) => item.id}
              />
              <DataTable columns={columns} data={[]} emptyTitle="Sin productos" />
              <DataTable
                columns={columns}
                data={[]}
                error="Falla de red"
                onRetry={() => {}}
              />
              <DataTable columns={columns} data={[]} isLoading />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
