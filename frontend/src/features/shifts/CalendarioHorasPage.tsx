// Calendario semanal por horas (estilo calendario de móvil) para Admin y Gerente.
//
// Muestra una rejilla de horas (filas) por días (columnas): los turnos FIJOS se
// dibujan como bloques que van de su hora de inicio a la de fin, y los VARIABLES
// como una etiqueta del día (sin horas). En móvil, una agenda de un día.
//
// No modifica el CalendarioTurnosPage existente: es una vista aparte que
// reutiliza las mismas consultas (`GET /assignments` paginado) y respeta los
// mismos permisos y alcance del backend.
import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  RepeatIcon,
  UsersIcon,
} from 'lucide-react'
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
  CabeceraImpresion,
  MenuImprimir,
  type ModoImpresion,
} from '@/components/shared/Impresion'
import { diasDeSemana, lunesDeSemana, sumarDias } from './semana'
import { useSucursalesTurnos, useTodasAsignaciones } from './queries'
import {
  etiquetaBloque,
  horasDeLaRejilla,
  seSolapan,
  variableTocaElDia,
  bloqueFijoDelDia,
  HORA_MINIMA,
  type BloqueFijo,
} from './calendario-horas'
import type { AsignacionApi } from '@/types/api'

/** Empleado de una asignación, para etiquetas y filtros. */
function nombreDe(asignacion: AsignacionApi): string {
  return asignacion.empleado.usuario.nombre
}

export function CalendarioHorasPage() {
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'Admin'

  const hoy = diaDeNegocioLima(new Date())
  const [lunes, setLunes] = useState(() => lunesDeSemana(hoy))
  const [sucursalAdmin, setSucursalAdmin] = useState('todas')
  const [empleadoFiltro, setEmpleadoFiltro] = useState('todos')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'fijo' | 'variable'>(
    'todos',
  )
  const [diaMovil, setDiaMovil] = useState(0)
  const [modoImpresion, setModoImpresion] = useState<ModoImpresion | null>(null)

  // Al elegir un modo de impresión, el DOM ya refleja el estado y se imprime.
  // `afterprint` repone el modo para no dejar la vista filtrada de por vida.
  useEffect(() => {
    if (modoImpresion === null) return
    window.print()
    const limpiar = () => setModoImpresion(null)
    window.addEventListener('afterprint', limpiar)
    return () => window.removeEventListener('afterprint', limpiar)
  }, [modoImpresion])

  const asignaciones = useTodasAsignaciones()
  const sucursales = useSucursalesTurnos(true)

  const domingo = sumarDias(lunes, 6)
  const dias = useMemo(() => diasDeSemana(lunes), [lunes])

  const crudas = useMemo(
    () => asignaciones.data?.items ?? [],
    [asignaciones.data],
  )

  const enSucursal = useMemo(
    () =>
      esAdmin && sucursalAdmin !== 'todas'
        ? crudas.filter(
            (a) => a.empleado.sucursalId === sucursalAdmin,
          )
        : crudas,
    [crudas, esAdmin, sucursalAdmin],
  )

  const filtradas = useMemo(
    () =>
      enSucursal.filter((a) => {
        if (empleadoFiltro !== 'todos' && a.empleadoId !== empleadoFiltro) {
          return false
        }
        if (tipoFiltro === 'fijo' && a.turno.tipo !== 'fijo') return false
        if (tipoFiltro === 'variable' && a.turno.tipo !== 'variable') return false
        return true
      }),
    [enSucursal, empleadoFiltro, tipoFiltro],
  )

  const empleados = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const a of crudas) {
      mapa.set(a.empleadoId, nombreDe(a))
    }
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'))
  }, [crudas])

  const nombreEmpleado =
    empleadoFiltro === 'todos'
      ? undefined
      : (empleados.find(([id]) => id === empleadoFiltro)?.[1] ?? undefined)

  const nombreSucursal = useMemo(() => {
    if (esAdmin) {
      if (sucursalAdmin === 'todas') return 'Todas las sucursales'
      return (
        (sucursales.data ?? []).find((s) => s.id === sucursalAdmin)?.nombre ??
        '—'
      )
    }
    return (
      (sucursales.data ?? []).find((s) => s.id === usuario?.sucursalId)
        ?.nombre ?? '—'
    )
  }, [esAdmin, sucursalAdmin, sucursales.data, usuario?.sucursalId])

  function imprimir(modo: ModoImpresion) {
    // En modo individual sin empleado elegido, se toma el primero para no
    // imprimir datos de otros empleados.
    if (modo === 'individual' && empleadoFiltro === 'todos' && empleados.length > 0) {
      setEmpleadoFiltro(empleados[0]![0])
    }
    setModoImpresion(modo)
  }

  const fijos = useMemo(
    () => filtradas.filter((a) => a.turno.tipo === 'fijo'),
    [filtradas],
  )
  const variables = useMemo(
    () => filtradas.filter((a) => a.turno.tipo === 'variable'),
    [filtradas],
  )

  const lunesActual = lunesDeSemana(hoy)
  const enSemanaActual = lunes === lunesActual
  const diaActual = sumarDias(lunes, diaMovil)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendario por horas"
        description={`Semana del ${formatearDiaLocal(lunes)} al ${formatearDiaLocal(domingo)}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Semana anterior"
              onClick={() => {
                setLunes(sumarDias(lunes, -7))
                setDiaMovil(0)
              }}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={enSemanaActual}
              onClick={() => {
                setLunes(lunesActual)
                setDiaMovil(0)
              }}
            >
              Semana actual
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Semana siguiente"
              onClick={() => {
                setLunes(sumarDias(lunes, 7))
                setDiaMovil(0)
              }}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
            <MenuImprimir onImprimir={imprimir} />
          </div>
        }
      />

      <CabeceraImpresion
        datos={{
          titulo:
            modoImpresion === 'individual'
              ? 'Horario semanal — individual'
              : 'Horario semanal — grupo',
          sucursal: nombreSucursal,
          empleado: modoImpresion === 'individual' ? nombreEmpleado : undefined,
          rango: `${formatearDiaLocal(lunes)} – ${formatearDiaLocal(domingo)}`,
        }}
      />

      <div className="no-print grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Empleados"
          value={empleados.length}
          icon={UsersIcon}
          hint="Con turno en la semana"
        />
        <StatCard
          title="Turnos fijos"
          value={new Set(fijos.map((a) => a.turnoId)).size}
          icon={ClockIcon}
          hint="Distintos en uso"
        />
        <StatCard
          title="Turnos variables"
          value={new Set(variables.map((a) => a.turnoId)).size}
          icon={RepeatIcon}
          hint="Distintos en uso"
        />
        <StatCard
          title="Asignaciones"
          value={filtradas.length}
          icon={CalendarDaysIcon}
          hint="Que tocan esta semana"
        />
      </div>

      <Card className="no-print">
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-3">
          {esAdmin && (
            <div className="space-y-2">
              <Label htmlFor="horas-sucursal">Sucursal</Label>
              <Select value={sucursalAdmin} onValueChange={setSucursalAdmin}>
                <SelectTrigger id="horas-sucursal">
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
          <div className="space-y-2">
            <Label htmlFor="horas-empleado">Empleado</Label>
            <Select value={empleadoFiltro} onValueChange={setEmpleadoFiltro}>
              <SelectTrigger id="horas-empleado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {empleados.map(([id, nombre]) => (
                  <SelectItem key={id} value={id}>
                    {nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="horas-tipo">Tipo</Label>
            <Select
              value={tipoFiltro}
              onValueChange={(v) => setTipoFiltro(v as typeof tipoFiltro)}
            >
              <SelectTrigger id="horas-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="fijo">Fijos</SelectItem>
                <SelectItem value="variable">Variables</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {asignaciones.data?.truncado && (
        <Card className="no-print">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Hay demasiadas asignaciones para mostrarlas todas; se muestran las
            primeras.
          </CardContent>
        </Card>
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
      ) : filtradas.length === 0 ? (
        <EmptyState
          title="Sin turnos en la semana"
          description="No hay asignaciones que toquen estos días en tu alcance."
        />
      ) : (
        <>
          {/* Rejilla de horas: escritorio. */}
          <Card className="hidden print:block print-avoid-break md:block">
            <CardContent className="overflow-x-auto pt-6">
              <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="border-b p-2 font-medium text-muted-foreground">
                      Hora
                    </th>
                    {dias.map((dia) => (
                      <th
                        key={dia.iso}
                        className="border-b p-2 text-center font-medium text-muted-foreground"
                      >
                        <div className="flex flex-col items-center">
                          <span>{dia.corto}</span>
                          <span className="text-xs font-normal">
                            {formatearDiaLocal(dia.iso).replace(/\s\d{4}$/, '')}
                          </span>
                          {dia.iso === hoy && (
                            <span className="mt-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                              Hoy
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {horasDeLaRejilla().map((minutos) => (
                    <tr key={minutos}>
                      <td className="border-b p-2 align-top text-xs font-medium text-muted-foreground">
                        {`${String(Math.floor(minutos / 60)).padStart(2, '0')}:00`}
                      </td>
                      {dias.map((dia) => {
                        const celda = celdaDe(
                          filtradas,
                          dia.iso,
                          minutos,
                        )
                        return (
                          <td
                            key={dia.iso}
                            className="border-b border-r p-1 align-top"
                          >
                            {celda.map((item) => (
                              <div
                                key={`${item.asignacion.id}-${item.tipo}`}
                                className="mb-1 rounded-md border border-primary/40 bg-primary/5 p-1.5 text-xs"
                              >
                                <span className="font-medium">{item.nombre}</span>
                                {item.tipo === 'fijo' ? (
                                  <span className="block text-muted-foreground">
                                    {etiquetaBloque(item.bloque)}
                                    {item.solapado && (
                                      <span className="ml-1 font-semibold">
                                        (solape)
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="block font-semibold">
                                    Variable
                                  </span>
                                )}
                              </div>
                            ))}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Agenda de un día: móvil. */}
          <Card className="no-print md:hidden">
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Día anterior"
                  disabled={diaMovil === 0}
                  onClick={() => setDiaMovil((d) => Math.max(0, d - 1))}
                >
                  <ChevronLeftIcon className="size-4" />
                </Button>
                <span className="text-sm font-medium">
                  {formatearDiaLocal(diaActual)}
                  {diaActual === hoy && (
                    <span className="ml-2 text-xs font-semibold text-primary">
                      Hoy
                    </span>
                  )}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Día siguiente"
                  disabled={diaMovil === 6}
                  onClick={() => setDiaMovil((d) => Math.min(6, d + 1))}
                >
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>
              {agendaDelDia(filtradas, diaActual).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin turnos este día.
                </p>
              ) : (
                agendaDelDia(filtradas, diaActual).map((item) => (
                  <div
                    key={`${item.asignacion.id}-${item.tipo}`}
                    className="rounded-md border p-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{item.nombre}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.tipo === 'fijo'
                          ? etiquetaBloque(item.bloque)
                          : 'Variable'}
                      </span>
                    </div>
                    {item.tipo === 'fijo' && item.solapado && (
                      <p className="mt-1 text-xs font-semibold text-destructive">
                        Se solapa con otro turno
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

type Celda =
  | {
      asignacion: AsignacionApi
      nombre: string
      tipo: 'fijo'
      bloque: BloqueFijo
      solapado: boolean
    }
  | {
      asignacion: AsignacionApi
      nombre: string
      tipo: 'variable'
      solapado: boolean
    }

/** Contenido de una celda (hora × día): turnos fijos que la cubren y variables. */
function celdaDe(
  asignaciones: AsignacionApi[],
  fechaIso: string,
  minutos: number,
): Celda[] {
  const resultado: Celda[] = []

  for (const asignacion of asignaciones) {
    if (asignacion.turno.tipo === 'variable') {
      // Solo se muestra en la primera hora de la rejilla.
      if (minutos === HORA_MINIMA * 60 && variableTocaElDia(asignacion, fechaIso)) {
        resultado.push({
          asignacion,
          nombre: nombreDe(asignacion),
          tipo: 'variable',
          solapado: false,
        })
      }
      continue
    }

    const bloque = bloqueFijoDelDia(asignacion, fechaIso)
    if (bloque === null) continue
    if (minutos < bloque.inicioMin || minutos >= bloque.finMin) continue

    const solapado = asignaciones.some((otra) => {
      if (otra.id === asignacion.id || otra.turno.tipo !== 'fijo') return false
      const bloqueOtra = bloqueFijoDelDia(otra, fechaIso)
      return bloqueOtra !== null && seSolapan(bloque, bloqueOtra)
    })

    resultado.push({
      asignacion,
      nombre: nombreDe(asignacion),
      tipo: 'fijo',
      bloque,
      solapado,
    })
  }

  return resultado
}

/** Agenda de un día: bloques fijos + variables, ordenados por hora. */
function agendaDelDia(asignaciones: AsignacionApi[], fechaIso: string): Celda[] {
  const resultado: Celda[] = []

  for (const asignacion of asignaciones) {
    if (asignacion.turno.tipo === 'variable') {
      if (variableTocaElDia(asignacion, fechaIso)) {
        resultado.push({
          asignacion,
          nombre: nombreDe(asignacion),
          tipo: 'variable',
          solapado: false,
        })
      }
      continue
    }

    const bloque = bloqueFijoDelDia(asignacion, fechaIso)
    if (bloque === null) continue

    const solapado = asignaciones.some((otra) => {
      if (otra.id === asignacion.id || otra.turno.tipo !== 'fijo') return false
      const bloqueOtra = bloqueFijoDelDia(otra, fechaIso)
      return bloqueOtra !== null && seSolapan(bloque, bloqueOtra)
    })

    resultado.push({
      asignacion,
      nombre: nombreDe(asignacion),
      tipo: 'fijo',
      bloque,
      solapado,
    })
  }

  return resultado.sort((a, b) => {
    const inicioA = a.tipo === 'fijo' ? a.bloque.inicioMin : 0
    const inicioB = b.tipo === 'fijo' ? b.bloque.inicioMin : 0
    return inicioA - inicioB
  })
}
