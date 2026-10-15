// Calendario semanal de turnos (lunes a domingo).
//
// Pinta una rejilla colaborador × día con la franja y el tipo de cada turno que
// toca en esa semana. El Admin puede acotar a una sucursal; el Gerente solo ve
// la suya (el backend acota el alcance), así que no se muestra selector.
//
// Las asignaciones sin días definidos (turnos variables a decisión) no tienen
// día fijo en la semana: se listan aparte en vez de ocultarse. El cuadro se
// apoya en `GET /assignments` paginado hasta un tope; si hay más asignaciones
// que las caben, se avisa de que está truncado en vez de mostrar datos
// incompletos sin más.
import { useMemo, useState } from 'react'
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  RepeatIcon,
  UserIcon,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { useAuth } from '@/lib/auth/useAuth'
import { diaDeNegocioLima, formatearDiaLocal } from '@/lib/format/dates'
import { mensajeDeError } from './mensajes'
import {
  formatearHorario,
  formatearVigencia,
  estadoAsignacion,
} from './presentacion'
import { diasDeSemana, lunesDeSemana, sumarDias } from './semana'
import { useSucursalesTurnos, useTodasAsignaciones } from './queries'
import { EstadoAsignacionBadge } from './EstadoAsignacionBadge'
import { TipoTurnoBadge } from './TipoTurnoBadge'
import type { AsignacionApi } from '@/types/api'

interface Celda {
  asignacion: AsignacionApi
}

export function CalendarioTurnosPage() {
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'Admin'

  const hoy = diaDeNegocioLima(new Date())
  const [lunes, setLunes] = useState(() => lunesDeSemana(hoy))
  const [sucursalAdmin, setSucursalAdmin] = useState('todas')

  const domingo = sumarDias(lunes, 6)
  const dias = useMemo(() => diasDeSemana(lunes), [lunes])

  const asignaciones = useTodasAsignaciones()
  const sucursales = useSucursalesTurnos(esAdmin)

  // Cruce real del rango con la semana: empieza antes o dentro y termina
  // después o dentro.
  const deLaSemana = useMemo(() => {
    const items = asignaciones.data?.items ?? []
    return items.filter((asignacion) => {
      const inicio = asignacion.fechaInicio.slice(0, 10)
      const fin = asignacion.fechaFin?.slice(0, 10) ?? '9999-12-31'
      return inicio <= domingo && fin >= lunes
    })
  }, [asignaciones.data, lunes, domingo])

  const visibles = useMemo(
    () =>
      esAdmin && sucursalAdmin !== 'todas'
        ? deLaSemana.filter(
            (asignacion) => asignacion.empleado.sucursalId === sucursalAdmin,
          )
        : deLaSemana,
    [deLaSemana, esAdmin, sucursalAdmin],
  )

  const conDias = useMemo(
    () =>
      visibles.filter(
        (asignacion) =>
          asignacion.turno.diasSemana !== null &&
          asignacion.turno.diasSemana !== '',
      ),
    [visibles],
  )

  const sinDias = useMemo(
    () =>
      visibles.filter(
        (asignacion) =>
          asignacion.turno.diasSemana === null ||
          asignacion.turno.diasSemana === '',
      ),
    [visibles],
  )

  const filas = useMemo(() => {
    const mapa = new Map<
      string,
      { nombre: string; cargo: string; sucursalId: string; celdas: Celda[] }
    >()
    for (const asignacion of conDias) {
      const clave = asignacion.empleadoId
      if (!mapa.has(clave)) {
        mapa.set(clave, {
          nombre: asignacion.empleado.usuario.nombre,
          cargo: asignacion.empleado.cargo,
          sucursalId: asignacion.empleado.sucursalId,
          celdas: [],
        })
      }
      mapa.get(clave)!.celdas.push({ asignacion })
    }
    return [...mapa.entries()]
      .map(([empleadoId, fila]) => ({ empleadoId, ...fila }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [conDias])

  const metricas = useMemo(() => {
    const colaboradores = new Set(visibles.map((a) => a.empleadoId)).size
    const turnosFijos = new Set(
      visibles.filter((a) => a.turno.tipo === 'fijo').map((a) => a.turnoId),
    ).size
    const turnosVariables = new Set(
      visibles.filter((a) => a.turno.tipo === 'variable').map((a) => a.turnoId),
    ).size
    return { colaboradores, turnosFijos, turnosVariables, total: visibles.length }
  }, [visibles])

  function celdaDe(diaIso: string, diaNumero: number, celdas: Celda[]) {
    const coincidencias = celdas.filter((celda) => {
      const asignacion = celda.asignacion
      const inicio = asignacion.fechaInicio.slice(0, 10)
      const fin = asignacion.fechaFin?.slice(0, 10) ?? '9999-12-31'
      if (diaIso < inicio || diaIso > fin) return false
      const diasTurno = (asignacion.turno.diasSemana ?? '')
        .split(',')
        .map((texto) => Number(texto.trim()))
      return diasTurno.includes(diaNumero)
    })

    if (coincidencias.length === 0) {
      return <span className="text-xs text-muted-foreground">—</span>
    }

    return (
      <div className="flex flex-col gap-1">
        {coincidencias.map((celda) => (
          <div key={celda.asignacion.id} className="flex flex-col gap-0.5">
            <TipoTurnoBadge tipo={celda.asignacion.turno.tipo} />
            <span className="text-xs text-muted-foreground">
              {formatearHorario(
                celda.asignacion.turno.horaInicio,
                celda.asignacion.turno.horaFin,
              )}
            </span>
          </div>
        ))}
      </div>
    )
  }

  const lunesActual = lunesDeSemana(hoy)
  const enSemanaActual = lunes === lunesActual

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendario de turnos"
        description={`Semana del ${formatearDiaLocal(lunes)} al ${formatearDiaLocal(domingo)}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Semana anterior"
              onClick={() => setLunes(sumarDias(lunes, -7))}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={enSemanaActual}
              onClick={() => setLunes(lunesActual)}
            >
              Semana actual
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Semana siguiente"
              onClick={() => setLunes(sumarDias(lunes, 7))}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Colaboradores"
          value={metricas.colaboradores}
          icon={UserIcon}
          hint="Con turno esta semana"
        />
        <StatCard
          title="Asignaciones"
          value={metricas.total}
          icon={CalendarDaysIcon}
          hint="Que tocan esta semana"
        />
        <StatCard
          title="Turnos fijos"
          value={metricas.turnosFijos}
          icon={ClockIcon}
          hint="Distintos en uso"
        />
        <StatCard
          title="Turnos variables"
          value={metricas.turnosVariables}
          icon={RepeatIcon}
          hint="Distintos en uso"
        />
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          {esAdmin && (
            <div className="space-y-2">
              <Label htmlFor="calendario-sucursal">Sucursal</Label>
              <Select value={sucursalAdmin} onValueChange={setSucursalAdmin}>
                <SelectTrigger id="calendario-sucursal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {(sucursales.data ?? []).map((sucursal) => (
                    <SelectItem key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-end gap-4 pb-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <TipoTurnoBadge tipo="fijo" /> Fijo
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TipoTurnoBadge tipo="variable" /> Variable
            </span>
          </div>
        </CardContent>
      </Card>

      {asignaciones.data?.truncado && (
        <Alert>
          <AlertTitle>Cuadro incompleto</AlertTitle>
          <AlertDescription>
            Hay demasiadas asignaciones para mostrarlas todas en una sola vista;
            se muestran las primeras.
          </AlertDescription>
        </Alert>
      )}

      {asignaciones.isLoading ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <Skeleton className="h-8 w-full" data-slot="skeleton" />
            <Skeleton className="h-8 w-full" data-slot="skeleton" />
            <Skeleton className="h-8 w-full" data-slot="skeleton" />
            <Skeleton className="h-8 w-full" data-slot="skeleton" />
          </CardContent>
        </Card>
      ) : asignaciones.isError ? (
        <ErrorState
          title="No se pudo cargar el calendario"
          description={mensajeDeError(asignaciones.error, 'listar')}
          onRetry={() => void asignaciones.refetch()}
        />
      ) : visibles.length === 0 ? (
        <EmptyState
          title="Sin turnos en la semana"
          description="No hay asignaciones que toquen estos días en tu alcance."
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left">
                  <th className="border-b p-2 font-medium text-muted-foreground">
                    Colaborador
                  </th>
                  {dias.map((dia) => (
                    <th
                      key={dia.iso}
                      className="border-b p-2 font-medium text-muted-foreground"
                    >
                      {dia.corto}{' '}
                      <span className="text-xs font-normal">
                        {formatearDiaLocal(dia.iso).replace(/\s\d{4}$/, '')}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => (
                  <tr key={fila.empleadoId}>
                    <td className="border-b p-2 align-top">
                      <div className="flex flex-col">
                        <span className="font-medium">{fila.nombre}</span>
                        <span className="text-xs text-muted-foreground">
                          {fila.cargo}
                        </span>
                      </div>
                    </td>
                    {dias.map((dia) => (
                      <td key={dia.iso} className="border-b p-2 align-top">
                        {celdaDe(dia.iso, dia.numero, fila.celdas)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {sinDias.length > 0 && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h3 className="text-sm font-semibold">
              Sin días fijos ({sinDias.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Estas asignaciones no tienen días de la semana definidos, así que no
              ocupan una casilla del calendario.
            </p>
            <ul className="space-y-2">
              {sinDias.map((asignacion) => (
                <li
                  key={asignacion.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {asignacion.empleado.usuario.nombre}
                    </span>
                    <TipoTurnoBadge tipo={asignacion.turno.tipo} />
                    <span className="text-muted-foreground">
                      {formatearHorario(
                        asignacion.turno.horaInicio,
                        asignacion.turno.horaFin,
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatearVigencia(
                        asignacion.fechaInicio,
                        asignacion.fechaFin,
                      )}
                    </span>
                    <EstadoAsignacionBadge
                      estado={estadoAsignacion(asignacion, hoy)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
