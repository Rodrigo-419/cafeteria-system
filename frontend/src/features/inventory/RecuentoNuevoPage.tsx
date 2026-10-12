// Pantalla para registrar un recuento físico.
//
// Un recuento fija el stock al valor CONTADO (es la única vía de bajarlo). El
// Admin elige la sucursal; el Gerente opera sobre la suya (el backend responde
// 404 fuera de alcance). Solo se envían las líneas con un valor introducido y
// válido; antes de enviar se muestra un resumen de diferencias para confirmar,
// porque la acción no se puede deshacer y cambia stock real.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeftIcon, ClipboardCheckIcon } from 'lucide-react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/lib/auth/useAuth'
import { formatearFechaHora } from '@/lib/format/dates'
import { VariacionStock } from './VariacionStock'
import {
  ETIQUETA_PRESENTACION,
  diferenciaContada,
  formatearCantidad,
  validarCantidad,
} from './presentacion'
import { mensajeDeError } from './mensajes'
import { LIMITE_RESUMEN, useCrearRecuento, useStock, useSucursales } from './queries'
import type { StockInsumoApi } from '@/types/api'

interface LineaContada {
  fila: StockInsumoApi
  texto: string
  valor: number
  diferencia: string
}

export function RecuentoNuevoPage() {
  const navegar = useNavigate()
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'Admin'

  const [sucursalAdmin, setSucursalAdmin] = useState('')
  const [conteos, setConteos] = useState<Record<string, string>>({})
  const [confirmar, setConfirmar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sucursalId = esAdmin
    ? sucursalAdmin || null
    : (usuario?.sucursalId ?? null)
  const sucursales = useSucursales(esAdmin)

  const stock = useStock(sucursalId, { page: 1, limit: LIMITE_RESUMEN })
  const crear = useCrearRecuento()

  const activos = useMemo(
    () => (stock.data?.data ?? []).filter((fila) => fila.estado === 'activo'),
    [stock.data],
  )

  const lineas = useMemo<LineaContada[]>(() => {
    return activos.flatMap((fila) => {
      const texto = conteos[fila.insumoId] ?? ''
      if (texto.trim() === '') return []
      const resultado = validarCantidad(texto, { estrictoPositivo: false })
      if (!resultado.valida) return []
      return [
        {
          fila,
          texto,
          valor: resultado.valor,
          diferencia: diferenciaContada(
            resultado.valor.toFixed(2),
            fila.stockActual,
          ),
        },
      ]
    })
  }, [activos, conteos])

  const hayInvalidas = useMemo(
    () =>
      activos.some((fila) => {
        const texto = conteos[fila.insumoId] ?? ''
        if (texto.trim() === '') return false
        return !validarCantidad(texto, { estrictoPositivo: false }).valida
      }),
    [activos, conteos],
  )

  const puedeRevisar = lineas.length > 0 && !hayInvalidas

  function registrar() {
    if (!sucursalId || !puedeRevisar) return
    setError(null)
    crear.mutate(
      {
        sucursalId,
        entrada: {
          items: lineas.map((linea) => ({
            insumoId: linea.fila.insumoId,
            stockFisico: linea.valor,
          })),
        },
      },
      {
        onSuccess: () => {
          toast.success('Recuento registrado')
          setConfirmar(false)
          navegar('/inventory/recuentos')
        },
        onError: (fallo: unknown) => {
          setError(mensajeDeError(fallo, 'recuento'))
          setConfirmar(false)
        },
      },
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo recuento"
        description="Cuenta el stock físico y ajústalo al valor real"
        actions={
          <Button variant="outline" onClick={() => navegar('/inventory/recuentos')}>
            <ArrowLeftIcon className="size-4" />
            Historial
          </Button>
        }
      />

      <Alert>
        <AlertTitle>El recuento fija el stock al valor contado</AlertTitle>
        <AlertDescription>
          Solo se envían las líneas con un valor introducido. El stock baja o
          sube hasta lo contado y queda un movimiento de ajuste; no se puede
          deshacer.
        </AlertDescription>
      </Alert>

      {esAdmin && (
        <Card>
          <CardContent className="pt-6">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="recuento-sucursal">Sucursal</Label>
              <Select
                value={sucursalAdmin}
                onValueChange={setSucursalAdmin}
              >
                <SelectTrigger id="recuento-sucursal">
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
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo registrar el recuento</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {sucursalId === null ? (
        <EmptyState
          title="Selecciona una sucursal"
          description="Elige la sucursal cuyo inventario quieres contar."
        />
      ) : stock.error ? (
        <ErrorState
          title="Error al cargar el stock"
          description={mensajeDeError(stock.error, 'stock')}
          onRetry={() => void stock.refetch()}
        />
      ) : stock.isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-9 w-full animate-pulse rounded bg-muted" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : activos.length === 0 ? (
        <EmptyState
          title="Sin insumos activos"
          description="Esta sucursal no tiene insumos activos para contar."
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead>Presentación</TableHead>
                <TableHead className="text-right">Stock sistema</TableHead>
                <TableHead className="w-40">Conteo físico</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activos.map((fila) => {
                const texto = conteos[fila.insumoId] ?? ''
                const resultado = validarCantidad(texto, {
                  estrictoPositivo: false,
                })
                const tocada = texto.trim() !== ''
                const diferencia =
                  tocada && resultado.valida
                    ? diferenciaContada(resultado.valor.toFixed(2), fila.stockActual)
                    : null
                const idError = `recuento-error-${fila.insumoId}`
                return (
                  <TableRow key={fila.id}>
                    <TableCell className="font-medium">
                      {fila.insumo.nombre}
                    </TableCell>
                    <TableCell>
                      {ETIQUETA_PRESENTACION[fila.insumo.presentacion]}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatearCantidad(fila.stockActual)}
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Conteo de ${fila.insumo.nombre}`}
                        inputMode="decimal"
                        value={texto}
                        aria-invalid={tocada && !resultado.valida}
                        aria-describedby={idError}
                        onChange={(evento) =>
                          setConteos((anterior) => ({
                            ...anterior,
                            [fila.insumoId]: evento.target.value,
                          }))
                        }
                      />
                      {tocada && !resultado.valida && (
                        <p id={idError} className="mt-1 text-xs text-destructive">
                          {resultado.mensaje}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {diferencia === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <VariacionStock cantidad={diferencia} />
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {sucursalId !== null && activos.length > 0 && (
        <div className="flex items-center justify-end gap-3">
          <span className="text-sm text-muted-foreground">
            {lineas.length} {lineas.length === 1 ? 'línea' : 'líneas'} contadas
          </span>
          <Button
            disabled={!puedeRevisar}
            onClick={() => setConfirmar(true)}
          >
            <ClipboardCheckIcon className="size-4" />
            Revisar recuento
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title="Confirmar recuento"
        description="Se fijará el stock al valor contado. Revisa las diferencias antes de continuar."
        confirmText={crear.isPending ? 'Registrando…' : 'Confirmar recuento'}
        loading={crear.isPending}
        onConfirm={registrar}
      >
        <div className="max-h-64 overflow-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead className="text-right">Sistema</TableHead>
                <TableHead className="text-right">Contado</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.map((linea) => (
                <TableRow key={linea.fila.id}>
                  <TableCell className="font-medium">
                    {linea.fila.insumo.nombre}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearCantidad(linea.fila.stockActual)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearCantidad(linea.valor.toFixed(2))}
                  </TableCell>
                  <TableCell className="text-right">
                    <VariacionStock cantidad={linea.diferencia} conEtiqueta={false} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {formatearFechaHora(new Date())} · {lineas.length}{' '}
          {lineas.length === 1 ? 'insumo' : 'insumos'}
        </p>
      </ConfirmDialog>
    </div>
  )
}
