import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { DataTable, type Column } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { MoneyText } from '@/components/shared/MoneyText'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useState } from 'react'

interface Item {
  id: string
  name: string
  price: number
}

export function DesignSystemPage() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const columns: Column<Item>[] = [
    { key: 'name', header: 'Nombre', cell: (i) => i.name },
    {
      key: 'price',
      header: 'Precio',
      cell: (i) => <MoneyText amountCents={i.price} />,
    },
  ]
  const data: Item[] = [
    { id: '1', name: 'Café', price: 500 },
    { id: '2', name: 'Té', price: 400 },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sistema de Diseño"
        description="Catálogo de componentes y estados (solo desarrollo)"
      />
      <Tabs defaultValue="atoms">
        <TabsList>
          <TabsTrigger value="atoms">Átomos</TabsTrigger>
          <TabsTrigger value="molecules">Moléculas</TabsTrigger>
          <TabsTrigger value="organisms">Organismos</TabsTrigger>
          <TabsTrigger value="states">Estados</TabsTrigger>
        </TabsList>
        <TabsContent value="atoms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Botones</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Formularios</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ds-input">Input</Label>
                <Input id="ds-input" placeholder="Escribe..." />
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
                <Textarea id="ds-textarea" placeholder="Texto largo..." />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="ds-check" />
                <Label htmlFor="ds-check">Checkbox</Label>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Badges & Skeleton</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="molecules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dropdown & Dialog</CardTitle>
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
                    <DialogDescription>
                      Contenido del diálogo.
                    </DialogDescription>
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
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="organisms" className="space-y-4">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.name}</TableCell>
                      <TableCell>
                        <MoneyText amountCents={d.price} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>DataTable con datos</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable columns={columns} data={data} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="states" className="space-y-4">
          <EmptyState
            title="Vacío"
            description="No hay elementos para mostrar."
          />
          <ErrorState
            title="Error"
            description="Algo salió mal."
            onRetry={() => {}}
          />
          <DataTable columns={columns} data={[]} isLoading />
          <DataTable columns={columns} data={[]} />
          <DataTable
            columns={columns}
            data={[]}
            error="Error de carga"
            onRetry={() => {}}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
