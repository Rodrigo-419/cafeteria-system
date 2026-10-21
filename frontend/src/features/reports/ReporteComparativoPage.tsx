// Reporte comparativo de sucursales.
//
// Solo lectura sobre `GET /reports/comparativo` (solo Admin). Presenta el
// periodo pedido (ventas, movimientos de inventario y faltas de asistencia) y,
// separado, el estado operativo en el momento de generar el reporte (insumos con
// alerta abierta y entradas de asistencia sin cerrar). No calcula métricas que
// el backend no entregue: solo suma importes y arma la comparación.
import { useState } from 'react'
import { AlertTriangleIcon, BanknoteIcon, PackageIcon, ReceiptIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { ErrorState } from '@/components/shared/ErrorState'
import { MoneyText } from '@/components/shared/MoneyText'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { StatusPill } from '@/components/shared/StatusPill'
import { diaDeNegocioLima, formatearDiaLocal, formatearFechaHora } from '@/lib/format/dates'
import type { FiltrosComparativo } from '@/lib/api/reports'
import { mensajeDeError } from './mensajes'
import {
  BotonImprimir,
  CabeceraImpresion,
} from '@/components/shared/Impresion'
import {
  centimosDeImporte,
  restarDias,
  totalesDeRed,
  validarRango,
} from './presentacion'
import { useReporteComparativo, useSucursalesParaReporte } from './queries'
import type { ReporteSucursalApi } from '@/types/api'

const TODAS = 'todas'

export function ReporteComparativoPage() {
  const hoy = diaDeNegocioLima(new Date())

  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(hoy)
  const [sucursalId, setSucursalId] = useState(TODAS)
  const [filtros, setFiltros] = useState<FiltrosComparativo | null>({
    desde: hoy,
    hasta: hoy,
  })
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null)

  const sucursales = useSucursalesParaReporte()
  const reporte = useReporteComparativo(filtros)

  function filtrarPorSucursal(): Partial<FiltrosComparativo> {
    return sucursalId === TODAS ? {} : { sucursalId }
  }

  function generarReporte() {
    const error = validarRango(desde, hasta)
    if (error) {
      setErrorValidacion(error)
      return
    }
    setErrorValidacion(null)
    setFiltros({ desde, hasta, ...filtrarPorSucursal() })
  }

  function usarRango(dias: number) {
    const inicio = restarDias(hoy, dias - 1)
    setDesde(inicio)
    setHasta(hoy)
    setErrorValidacion(null)
    setFiltros({ desde: inicio, hasta: hoy, ...filtrarPorSucursal() })
  }

  const filas = reporte.data?.sucursales ?? []
  const totales = totalesDeRed(filas)

  const columnasPeriodo: Column<ReporteSucursalApi>[] = [
    {
      key: 'sucursal',
      header: 'Sucursal',
      cell: (fila) => <span className="font-medium">{fila.sucursalNombre}</span>,
    },
    {
      key: 'ventas',
      header: 'Ventas',
      className: 'text-right',
      cell: (fila) => (
        <MoneyText
          amountCents={centimosDeImporte(fila.ventas.total)}
          className="tabular-nums"
        />
      ),
    },
    {
      key: 'tickets',
      header: 'Tickets',
      className: 'text-right',
      cell: (fila) => <span className="tabular-nums">{fila.ventas.cantidad}</span>,
    },
    {
      key: 'ticketPromedio',
      header: 'Ticket promedio',
      className: 'text-right',
      cell: (fila) =>
        fila.ventas.ticketPromedio === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <MoneyText
            amountCents={centimosDeImporte(fila.ventas.ticketPromedio)}
            className="tabular-nums"
          />
        ),
    },
    {
      key: 'anuladas',
      header: 'Anuladas',
      className: 'text-right',
      cell: (fila) => (
        <span className="tabular-nums">{fila.ventas.anuladas.cantidad}</span>
      ),
    },
    {
      key: 'entradas',
      header: 'Entradas',
      className: 'text-right',
      cell: (fila) => (
        <span className="tabular-nums">
          {fila.inventario.movimientos.entradas.cantidad}
        </span>
      ),
    },
    {
      key: 'ajustes',
      header: 'Ajustes',
      className: 'text-right',
      cell: (fila) => (
        <span className="tabular-nums">
          {fila.inventario.movimientos.ajustes.cantidad}
        </span>
      ),
    },
    {
      key: 'faltas',
      header: 'Faltas',
      className: 'text-right',
      cell: (fila) => (
        <span className="tabular-nums">
          {fila.asistencia.faltas}
          {fila.asistencia.faltasJustificadas > 0 && (
            <span className="text-muted-foreground">
              {' '}
              · {fila.asistencia.faltasJustificadas} just.
            </span>
          )}
        </span>
      ),
    },
  ]

  const columnasEstado: Column<ReporteSucursalApi>[] = [
    {
      key: 'sucursal',
      header: 'Sucursal',
      cell: (fila) => <span className="font-medium">{fila.sucursalNombre}</span>,
    },
    {
      key: 'alertas',
      header: 'Insumos con alerta abierta',
      cell: (fila) =>
        fila.estadoActual.insumosConAlertaAbierta > 0 ? (
          <StatusPill tono="warning">
            {fila.estadoActual.insumosConAlertaAbierta}
          </StatusPill>
        ) : (
          <StatusPill tono="neutral">Sin alertas</StatusPill>
        ),
    },
    {
      key: 'entradasAbiertas',
      header: 'Entradas abiertas',
      className: 'text-right',
      cell: (fila) => (
        <span className="tabular-nums">{fila.estadoActual.entradasAbiertas}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reporte comparativo de sucursales"
        description="Ventas, inventario y asistencia por sucursal en un rango de días."
        actions={<BotonImprimir />}
      />

      <CabeceraImpresion
        datos={{
          titulo: 'Reporte comparativo de sucursales',
          sucursal:
            sucursalId === TODAS
              ? 'Todas las sucursales'
              : ((sucursales.data ?? []).find((s) => s.id === sucursalId)
                  ?.nombre ?? '—'),
          rango:
            reporte.data !== undefined
              ? `${formatearDiaLocal(reporte.data.desde)} – ${formatearDiaLocal(reporte.data.hasta)}`
              : undefined,
        }}
        ahora={reporte.data ? new Date(reporte.data.generadoEn) : new Date()}
      />

      <Card className="no-print">
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="reporte-desde">Desde</Label>
              <Input
                id="reporte-desde"
                type="date"
                value={desde}
                onChange={(evento) => setDesde(evento.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reporte-hasta">Hasta</Label>
              <Input
                id="reporte-hasta"
                type="date"
                value={hasta}
                onChange={(evento) => setHasta(evento.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reporte-sucursal">Sucursal</Label>
              <Select value={sucursalId} onValueChange={setSucursalId}>
                <SelectTrigger id="reporte-sucursal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Todas las sucursales</SelectItem>
                  {(sucursales.data ?? []).map((sucursal) => (
                    <SelectItem key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={generarReporte}>
                Generar reporte
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Rangos rápidos:</span>
            <Button variant="outline" size="sm" onClick={() => usarRango(1)}>
              Hoy
            </Button>
            <Button variant="outline" size="sm" onClick={() => usarRango(7)}>
              7 días
            </Button>
            <Button variant="outline" size="sm" onClick={() => usarRango(30)}>
              30 días
            </Button>
          </div>

          {errorValidacion && (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertTitle>Revisa el rango de fechas</AlertTitle>
              <AlertDescription>{errorValidacion}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {reporte.isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((indice) => (
              <Skeleton key={indice} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : reporte.error ? (
        <ErrorState
          title="No se pudo generar el reporte"
          description={mensajeDeError(reporte.error)}
          onRetry={() => void reporte.refetch()}
        />
      ) : reporte.data ? (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Periodo {formatearDiaLocal(reporte.data.desde)} –{' '}
            {formatearDiaLocal(reporte.data.hasta)} · Generado el{' '}
            {formatearFechaHora(reporte.data.generadoEn)}
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Ventas de la red"
              icon={BanknoteIcon}
              value={<MoneyText amountCents={totales.ventasCentimos} />}
              hint={`${totales.tickets} ${totales.tickets === 1 ? 'ticket' : 'tickets'}`}
            />
            <StatCard
              title="Ticket promedio"
              icon={ReceiptIcon}
              value={
                totales.ticketPromedioCentimos === null ? (
                  '—'
                ) : (
                  <MoneyText amountCents={totales.ticketPromedioCentimos} />
                )
              }
              hint="Sobre ventas del periodo"
            />
            <StatCard
              title="Movimientos de inventario"
              icon={PackageIcon}
              value={totales.movimientos}
              hint="Entradas y ajustes del periodo"
            />
            <StatCard
              title="Alertas de stock abiertas"
              icon={AlertTriangleIcon}
              value={totales.alertasAbiertas}
              tone={totales.alertasAbiertas > 0 ? 'warning' : 'default'}
              hint="Estado al generar el reporte"
            />
          </div>

          <section className="print-avoid-break space-y-3">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">
                Comparativo del periodo
              </h2>
              <p className="text-sm text-muted-foreground">
                Ventas, movimientos de inventario y faltas dentro del rango
                seleccionado.
              </p>
            </div>
            <DataTable
              columns={columnasPeriodo}
              data={filas}
              getRowId={(fila) => fila.sucursalId}
              emptyTitle="Sin sucursales"
              emptyDescription="No hay sucursales que comparar en el alcance del reporte."
            />
          </section>

          <section className="print-avoid-break space-y-3">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">
                Estado actual
              </h2>
              <p className="text-sm text-muted-foreground">
                Situación operativa en el momento de generar el reporte, no del
                periodo.
              </p>
            </div>
            <DataTable
              columns={columnasEstado}
              data={filas}
              getRowId={(fila) => fila.sucursalId}
              emptyTitle="Sin sucursales"
              emptyDescription="No hay sucursales en el alcance del reporte."
            />
          </section>
        </div>
      ) : null}
    </div>
  )
}
