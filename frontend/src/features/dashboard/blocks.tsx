// Bloques del panel de control.
//
// Cada bloque es autónomo: monta su propia consulta, se habilita solo con su
// permiso y resuelve su propio estado de carga/vacío/error, de modo que el fallo
// de un bloque no rompe el resto del panel. Ningún bloque inventa datos: solo
// muestra lo que devuelven las rutas existentes del backend.
import { Link } from 'react-router-dom'
import {
  ArrowRightIcon,
  BanIcon,
  BanknoteIcon,
  KeyRoundIcon,
  PlusIcon,
  ReceiptIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { MoneyText } from '@/components/shared/MoneyText'
import { StatCard } from '@/components/shared/StatCard'
import { StatusPill } from '@/components/shared/StatusPill'
import { ApiError } from '@/lib/api/errors'
import { useAuth } from '@/lib/auth/useAuth'
import { formatearHora } from '@/lib/format/dates'
import { filtrarMenu } from '@/lib/navigation/menu'
import { tienePermiso } from '@/lib/permissions/permissions'
import { SaleStatusBadge } from '@/features/sales/SaleStatusBadge'
import { precioEnCentimos } from '@/features/sales/presentacion'
import {
  ETIQUETA_ESTADO_EQUIPO,
  ORDEN_ESTADOS_EQUIPO,
  TONO_ESTADO_EQUIPO,
} from './presentacion'
import {
  useAlertasAbiertas,
  useAsistenciaAbierta,
  useEquipos,
  useReporteComparativo,
  useVentasDelDia,
} from './queries'

/** Mensaje legible para el error de un bloque, acotado a su recurso. */
function mensajeDeBloque(error: unknown, recurso: string): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return `No tienes permiso para consultar ${recurso}.`
    }
    if (error.status >= 500) {
      return `El servidor no pudo entregar ${recurso}. Vuelve a intentarlo.`
    }
    return error.mensajes.join(' ') || `No se pudo consultar ${recurso}.`
  }
  return `No se pudo conectar con el servidor para consultar ${recurso}.`
}

interface TarjetaBloqueProps {
  titulo: string
  descripcion?: string
  accion?: React.ReactNode
  children: React.ReactNode
}

/** Tarjeta con cabecera, usada por la mayoría de los bloques del panel. */
function TarjetaBloque({
  titulo,
  descripcion,
  accion,
  children,
}: TarjetaBloqueProps) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{titulo}</CardTitle>
        {descripcion && <CardDescription>{descripcion}</CardDescription>}
        {accion && <CardAction>{accion}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function EsqueletoLista({ filas = 3 }: { filas?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: filas }).map((_, indice) => (
        <Skeleton key={indice} className="h-10 w-full" />
      ))}
    </div>
  )
}

function ErrorBloque({
  mensaje,
  onRetry,
}: {
  mensaje: string
  onRetry: () => void
}) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2 text-sm">
      <p className="text-destructive">{mensaje}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  )
}

/** KPIs de las ventas del día (monto, ticket promedio y anuladas). */
export function ResumenVentasHoy() {
  const { data, isPending, error, refetch } = useVentasDelDia()

  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((indice) => (
          <Skeleton key={indice} className="h-32 rounded-xl" />
        ))}
      </div>
    )
  }
  if (error) {
    return (
      <ErrorState
        title="No se pudo cargar el resumen de ventas"
        description={mensajeDeBloque(error, 'las ventas del día')}
        onRetry={() => void refetch()}
      />
    )
  }

  const ventas = data.data
  const completadas = ventas.filter((venta) => venta.estado === 'completada')
  const totalCentimos = completadas.reduce(
    (acumulado, venta) => acumulado + (precioEnCentimos(venta.total) ?? 0),
    0,
  )
  const ticketPromedio =
    completadas.length > 0
      ? Math.round(totalCentimos / completadas.length)
      : 0
  const anuladas = ventas.length - completadas.length

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Ventas de hoy"
        icon={BanknoteIcon}
        value={<MoneyText amountCents={totalCentimos} />}
        hint={`${completadas.length} ${completadas.length === 1 ? 'venta completada' : 'ventas completadas'}`}
      />
      <StatCard
        title="Ticket promedio"
        icon={ReceiptIcon}
        value={<MoneyText amountCents={ticketPromedio} />}
        hint="Sobre ventas completadas"
      />
      <StatCard
        title="Anuladas hoy"
        icon={BanIcon}
        value={anuladas}
        tone={anuladas > 0 ? 'warning' : 'default'}
        hint={anuladas === 0 ? 'Ninguna venta anulada' : 'Ventas anuladas del día'}
      />
    </div>
  )
}

/** Las ventas más recientes del día. */
export function UltimasVentas() {
  const { data, isPending, error, refetch } = useVentasDelDia()

  return (
    <TarjetaBloque
      titulo="Últimas ventas"
      descripcion="Movimientos más recientes de hoy"
      accion={
        <Button asChild variant="ghost" size="sm">
          <Link to="/sales">
            Ver todas
            <ArrowRightIcon />
          </Link>
        </Button>
      }
    >
      {isPending ? (
        <EsqueletoLista />
      ) : error ? (
        <ErrorBloque
          mensaje={mensajeDeBloque(error, 'las ventas')}
          onRetry={() => void refetch()}
        />
      ) : data.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no se registraron ventas hoy.
        </p>
      ) : (
        <ul className="divide-y">
          {data.data.slice(0, 5).map((venta) => (
            <li
              key={venta.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {venta.vendedor.nombre}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatearHora(venta.createdAt)} · {venta.lineas}{' '}
                  {venta.lineas === 1 ? 'línea' : 'líneas'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <SaleStatusBadge estado={venta.estado} />
                <MoneyText
                  amountCents={precioEnCentimos(venta.total) ?? 0}
                  className="text-sm font-semibold tabular-nums"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </TarjetaBloque>
  )
}

/** Alertas de stock abiertas. */
export function AlertasStock() {
  const { data, isPending, error, refetch } = useAlertasAbiertas()

  return (
    <TarjetaBloque
      titulo="Alertas de stock"
      descripcion={
        data
          ? `${data.total} ${data.total === 1 ? 'alerta abierta' : 'alertas abiertas'}`
          : 'Insumos por debajo del mínimo'
      }
    >
      {isPending ? (
        <EsqueletoLista />
      ) : error ? (
        <ErrorBloque
          mensaje={mensajeDeBloque(error, 'las alertas de stock')}
          onRetry={() => void refetch()}
        />
      ) : data.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay alertas de stock abiertas.
        </p>
      ) : (
        <ul className="divide-y">
          {data.data.slice(0, 5).map((alerta) => (
            <li
              key={alerta.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {alerta.insumoSucursal.insumo.nombre}
                </p>
                <p className="text-xs text-muted-foreground">
                  Stock {alerta.insumoSucursal.stockActual} · mínimo{' '}
                  {alerta.insumoSucursal.stockMinimo}
                </p>
              </div>
              <StatusPill tono="error">Stock bajo</StatusPill>
            </li>
          ))}
        </ul>
      )}
    </TarjetaBloque>
  )
}

/** Entradas de asistencia que siguen abiertas (sin salida cerrada). */
export function AsistenciaAbierta() {
  const { data, isPending, error, refetch } = useAsistenciaAbierta()

  return (
    <TarjetaBloque
      titulo="Personal en turno"
      descripcion={
        data
          ? `${data.total} ${data.total === 1 ? 'entrada abierta' : 'entradas abiertas'}`
          : 'Entradas sin salida cerrada'
      }
    >
      {isPending ? (
        <EsqueletoLista />
      ) : error ? (
        <ErrorBloque
          mensaje={mensajeDeBloque(error, 'la asistencia')}
          onRetry={() => void refetch()}
        />
      ) : data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay entradas abiertas en este momento.
        </p>
      ) : (
        <ul className="divide-y">
          {data.items.slice(0, 5).map((registro) => (
            <li
              key={registro.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <p className="truncate text-sm font-medium">
                {registro.empleado.nombre}
              </p>
              <p className="shrink-0 text-xs text-muted-foreground">
                Entrada {formatearHora(registro.fechaHora)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </TarjetaBloque>
  )
}

/** Conteo de equipos por estado. */
export function EquiposResumen() {
  const { data, isPending, error, refetch } = useEquipos()

  return (
    <TarjetaBloque
      titulo="Equipos"
      descripcion={
        data ? `${data.total} equipos registrados` : 'Estado del equipamiento'
      }
    >
      {isPending ? (
        <EsqueletoLista filas={4} />
      ) : error ? (
        <ErrorBloque
          mensaje={mensajeDeBloque(error, 'los equipos')}
          onRetry={() => void refetch()}
        />
      ) : (
        <ul className="space-y-3">
          {ORDEN_ESTADOS_EQUIPO.map((estado) => {
            const cantidad = data.data.filter(
              (equipo) => equipo.estado === estado,
            ).length
            return (
              <li key={estado} className="flex items-center justify-between">
                <StatusPill tono={TONO_ESTADO_EQUIPO[estado]}>
                  {ETIQUETA_ESTADO_EQUIPO[estado]}
                </StatusPill>
                <span className="text-sm font-semibold tabular-nums">
                  {cantidad}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </TarjetaBloque>
  )
}

/** Comparativo de ventas e incidencias entre sucursales del día. */
export function ReporteComparativoSucursales() {
  const { data, isPending, error, refetch } = useReporteComparativo()

  return (
    <TarjetaBloque
      titulo="Comparativo entre sucursales"
      descripcion="Ventas, incidencias y estado actual del día"
    >
      {isPending ? (
        <EsqueletoLista filas={4} />
      ) : error ? (
        <ErrorBloque
          mensaje={mensajeDeBloque(error, 'el reporte comparativo')}
          onRetry={() => void refetch()}
        />
      ) : data.sucursales.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay sucursales que comparar.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sucursal</TableHead>
              <TableHead className="text-right">Ventas</TableHead>
              <TableHead className="text-right">Tickets</TableHead>
              <TableHead className="text-right">Ticket prom.</TableHead>
              <TableHead className="text-right">Alertas</TableHead>
              <TableHead className="text-right">En turno</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.sucursales.map((fila) => (
              <TableRow key={fila.sucursalId}>
                <TableCell className="font-medium">
                  {fila.sucursalNombre}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <MoneyText
                    amountCents={precioEnCentimos(fila.ventas.total) ?? 0}
                  />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fila.ventas.cantidad}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fila.ventas.ticketPromedio === null ? (
                    '—'
                  ) : (
                    <MoneyText
                      amountCents={
                        precioEnCentimos(fila.ventas.ticketPromedio) ?? 0
                      }
                    />
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fila.estadoActual.insumosConAlertaAbierta}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fila.estadoActual.entradasAbiertas}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </TarjetaBloque>
  )
}

/**
 * Accesos directos del panel: acciones de ventas permitidas y, si además hay
 * permiso de marcación y sesión con sucursal, el atajo al terminal de
 * asistencia (misma condición que la ruta, sin duplicar reglas por rol).
 */
export function AccesosRapidos() {
  const { permisos, usuario } = useAuth()
  const puedeRegistrar = tienePermiso(permisos, 'ventas.registrar')
  const puedeVer = tienePermiso(permisos, 'ventas.ver')
  const puedeMarcar =
    tienePermiso(permisos, 'asistencia.marcar') && usuario?.sucursalId != null

  if (!puedeRegistrar && !puedeVer && !puedeMarcar) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      {puedeRegistrar && (
        <Button asChild>
          <Link to="/sales/nueva">
            <PlusIcon />
            Nueva venta
          </Link>
        </Button>
      )}
      {puedeVer && (
        <Button asChild variant="outline">
          <Link to="/sales">Ver ventas</Link>
        </Button>
      )}
      {puedeMarcar && (
        <Button asChild variant="outline">
          <Link to="/attendance/terminal">
            <KeyRoundIcon />
            Marcar asistencia
          </Link>
        </Button>
      )}
    </div>
  )
}

/** Estado vacío del panel cuando no hay ningún permiso de resumen. */
export function SinResumen() {
  return (
    <EmptyState
      title="No hay información para tu perfil"
      description="Tu cuenta no tiene permisos para ver resúmenes. Contacta a un administrador si necesitas acceso."
    />
  )
}

/** Estado vacío del panel cuando el usuario no tiene ninguna sección asignada. */
export function SinModulos() {
  return (
    <EmptyState
      title="No tienes módulos asignados"
      description="Tu cuenta no tiene acceso a ninguna sección. Contacta a tu gerente para que te asigne permisos."
    />
  )
}

/**
 * Tarjetas con las secciones que el usuario puede usar, reutilizando la misma
 * definición del menú lateral (`filtrarMenu`) para no duplicar reglas. Así el
 * panel nunca queda vacío para un usuario con pocos permisos.
 */
export function AccesosDisponibles() {
  const { permisos } = useAuth()
  const secciones = filtrarMenu(permisos).filter((item) => item.to !== '/')

  if (secciones.length === 0) {
    return null
  }

  return (
    <TarjetaBloque
      titulo="Accesos disponibles"
      descripcion="Secciones habilitadas para tu perfil"
    >
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {secciones.map((seccion) => (
          <li key={seccion.to}>
            <Link
              to={seccion.to}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {seccion.label}
              <ArrowRightIcon className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </TarjetaBloque>
  )
}
