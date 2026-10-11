// Sección "Carta por sucursal": precios y estado de cada variante de producto en
// una sucursal concreta.
//
// - Empleado: solo consulta (el backend solo le devuelve ofertas activas).
// - Gerente: gestiona precios de su propia sucursal (`productos.precio.editar`).
// - Admin: puede consultar cualquier sucursal, pero no editar precios.
import { useMemo, useState } from 'react'
import { PencilIcon, PlusIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { MoneyText } from '@/components/shared/MoneyText'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import { EstadoOfertaBadge } from './EstadoOfertaBadge'
import { OfertaDialog } from './OfertaDialog'
import { mensajeDeError } from './mensajes'
import { precioEnCentimos } from './presentacion'
import { useCartaSucursal, useSucursales } from './queries'
import type { CartaOferta, EstadoOferta } from '@/types/api'

type FiltroEstado = EstadoOferta | 'todas'

export function CartaSeccion() {
  const { usuario, permisos } = useAuth()
  const esAdmin = usuario?.rol === 'Admin'
  const puedeEditarPrecio = tienePermiso(permisos, 'productos.precio.editar')

  const [sucursalAdmin, setSucursalAdmin] = useState('')
  const [estado, setEstado] = useState<FiltroEstado>('todas')
  const [dialogo, setDialogo] = useState<
    { oferta: CartaOferta } | 'crear' | null
  >(null)

  const sucursalId = esAdmin ? sucursalAdmin : (usuario?.sucursalId ?? null)
  const sucursales = useSucursales(esAdmin)
  const { data, isLoading, error, refetch } = useCartaSucursal(
    sucursalId,
    estado,
  )

  const mostrarFiltroEstado = esAdmin || puedeEditarPrecio

  const columnas: Column<CartaOferta>[] = useMemo(
    () => [
      {
        key: 'producto',
        header: 'Producto',
        cell: (fila) => (
          <span className="font-medium">{fila.producto.nombre}</span>
        ),
      },
      {
        key: 'categoria',
        header: 'Categoría',
        cell: (fila) => fila.producto.categoria.nombre,
      },
      {
        key: 'variante',
        header: 'Variante',
        cell: (fila) => fila.variante.nombre,
      },
      {
        key: 'precio',
        header: 'Precio',
        cell: (fila) => (
          <MoneyText amountCents={precioEnCentimos(fila.precio)} />
        ),
      },
      {
        key: 'estado',
        header: 'Estado',
        cell: (fila) => <EstadoOfertaBadge estado={fila.estado} />,
      },
      ...(puedeEditarPrecio
        ? [
            {
              key: 'acciones',
              header: '',
              className: 'text-right',
              cell: (fila: CartaOferta) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDialogo({ oferta: fila })}
                >
                  <PencilIcon className="size-4" />
                  Editar precio
                </Button>
              ),
            } satisfies Column<CartaOferta>,
          ]
        : []),
    ],
    [puedeEditarPrecio],
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
          {esAdmin && (
            <div className="space-y-2">
              <Label htmlFor="carta-sucursal">Sucursal</Label>
              <Select value={sucursalAdmin} onValueChange={setSucursalAdmin}>
                <SelectTrigger id="carta-sucursal">
                  <SelectValue placeholder="Selecciona una sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {(sucursales.data ?? []).map((sucursal) => (
                    <SelectItem key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mostrarFiltroEstado && (
            <div className="space-y-2">
              <Label htmlFor="carta-estado">Estado</Label>
              <Select
                value={estado}
                onValueChange={(valor) => setEstado(valor as FiltroEstado)}
              >
                <SelectTrigger id="carta-estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos</SelectItem>
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="inactivo">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {puedeEditarPrecio && sucursalId && (
        <div className="flex justify-end">
          <Button onClick={() => setDialogo('crear')}>
            <PlusIcon className="size-4" />
            Añadir a la carta
          </Button>
        </div>
      )}

      {sucursalId === null ? (
        <EmptyState
          title="Selecciona una sucursal"
          description="Elige una sucursal para consultar su carta de precios."
        />
      ) : (
        <DataTable
          columns={columnas}
          data={data ?? []}
          isLoading={isLoading}
          error={error ? mensajeDeError(error, 'carta') : null}
          onRetry={() => void refetch()}
          getRowId={(fila) => fila.id}
          emptyTitle="Sin precios en la carta"
          emptyDescription="Esta sucursal todavía no tiene productos con precio."
        />
      )}

      {dialogo !== null && sucursalId && (
        <OfertaDialog
          sucursalId={sucursalId}
          oferta={dialogo === 'crear' ? null : dialogo.oferta}
          onClose={() => setDialogo(null)}
        />
      )}
    </div>
  )
}
