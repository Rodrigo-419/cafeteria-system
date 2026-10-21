// Pantalla "Mi horario": turnos del empleado vinculado al usuario autenticado.
//
// Es de solo lectura y personal: no se deriva de un permiso (la ruta exige
// solo autenticación). Muestra la semana actual con navegación anterior/
// siguiente/hoy y, en móvil, una agenda de un día.
import { useMemo, useState } from 'react'
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  RepeatIcon,
  UserIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { useMiHorario } from './queries'
import { BotonImprimir, CabeceraImpresion } from '@/components/shared/Impresion'
import {
  diaDeNegocioLima,
  formatearDiaLocal,
} from '@/lib/format/dates'
import { lunesDeSemana, sumarDias } from '@/features/shifts/semana'
import { TipoTurnoBadge } from '@/features/shifts/TipoTurnoBadge'
import type { DiaMiHorarioApi } from '@/types/api'

function formatearHorario(
  horaInicio: string | null,
  horaFin: string | null,
): string {
  if (horaInicio === null || horaFin === null) return 'Horario variable'
  // Las horas del backend ya son "HH:mm"; se muestran tal cual.
  return `${horaInicio} – ${horaFin}`
}

function DiaColumna({ dia }: { dia: DiaMiHorarioApi }) {
  const esHoy = dia.fecha === diaDeNegocioLima(new Date())
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">
        {formatearDiaLocal(dia.fecha)}
      </span>
      {esHoy && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          Hoy
        </span>
      )}
      {dia.turno === null ? (
        <span className="text-xs text-muted-foreground">—</span>
      ) : (
        <div className="flex flex-col gap-0.5">
          <TipoTurnoBadge tipo={dia.turno.tipo} />
          <span className="text-xs text-muted-foreground">
            {formatearHorario(dia.turno.horaInicio, dia.turno.horaFin)}
          </span>
        </div>
      )}
    </div>
  )
}

export function MiHorarioPage() {
  const hoy = diaDeNegocioLima(new Date())
  const [lunes, setLunes] = useState(() => lunesDeSemana(hoy))

  const desde = lunes
  const hasta = sumarDias(lunes, 6)
  const horario = useMiHorario({ desde, hasta })

  const lunesActual = lunesDeSemana(hoy)
  const enSemanaActual = lunes === lunesActual

  const domingo = sumarDias(lunes, 6)
  const dias = useMemo(() => horario.data?.dias ?? [], [horario.data])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mi horario"
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
            <BotonImprimir />
          </div>
        }
      />

      <CabeceraImpresion
        datos={{
          titulo: 'Mi horario semanal',
          sucursal: horario.data?.empleado.sucursal,
          empleado: horario.data?.empleado.nombre,
          rango: `${formatearDiaLocal(lunes)} – ${formatearDiaLocal(domingo)}`,
        }}
      />

      {horario.data?.empleado && (
        <div className="no-print grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserIcon className="size-5" />
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {horario.data.empleado.nombre}
              </p>
              <p className="text-xs text-muted-foreground">
                {horario.data.empleado.cargo}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDaysIcon className="size-5" />
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {horario.data.empleado.sucursal}
              </p>
              <p className="text-xs text-muted-foreground">Sucursal</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ClockIcon className="size-5" />
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {dias.filter((d) => d.turno?.tipo === 'fijo').length} días
              </p>
              <p className="text-xs text-muted-foreground">Turno fijo</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RepeatIcon className="size-5" />
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {dias.filter((d) => d.turno?.tipo === 'variable').length} días
              </p>
              <p className="text-xs text-muted-foreground">Turno variable</p>
            </div>
          </div>
        </div>
      )}

      {horario.isLoading ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <Skeleton className="h-8 w-full" data-slot="skeleton" />
            <Skeleton className="h-8 w-full" data-slot="skeleton" />
            <Skeleton className="h-8 w-full" data-slot="skeleton" />
            <Skeleton className="h-8 w-full" data-slot="skeleton" />
          </CardContent>
        </Card>
      ) : horario.isError ? (
        <ErrorState
          title="No se pudo cargar tu horario"
          description="Inténtalo de nuevo en unos momentos."
          onRetry={() => void horario.refetch()}
        />
      ) : dias.every((d) => d.turno === null) ? (
        <EmptyState
          title="Sin turnos esta semana"
          description="No tienes asignaciones que toquen estos días."
        />
      ) : (
        <>
          {/* Agenda de un día: solo en móvil, sin scroll horizontal del cuerpo. */}
          <Card className="md:hidden">
            <CardContent className="space-y-3 pt-6">
              {dias.map((dia) => {
                const esHoy = dia.fecha === diaDeNegocioLima(new Date())
                return (
                  <div
                    key={dia.fecha}
                    className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        {formatearDiaLocal(dia.fecha)}
                      </span>
                      {esHoy && (
                        <span className="text-xs font-medium text-primary">
                          Hoy
                        </span>
                      )}
                    </div>
                    {dia.turno === null ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-col items-end gap-0.5">
                        <TipoTurnoBadge tipo={dia.turno.tipo} />
                        <span className="text-xs text-muted-foreground">
                          {formatearHorario(
                            dia.turno.horaInicio,
                            dia.turno.horaFin,
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Tabla semanal: solo en escritorio. */}
          <Card className="hidden print:block print-avoid-break md:block">
            <CardContent className="overflow-x-auto pt-6">
              <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="border-b p-2 font-medium text-muted-foreground">
                      Día
                    </th>
                    <th className="border-b p-2 font-medium text-muted-foreground">
                      Turno
                    </th>
                    <th className="border-b p-2 font-medium text-muted-foreground">
                      Horario
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dias.map((dia) => (
                    <tr key={dia.fecha}>
                      <td className="border-b p-2 align-top">
                        <DiaColumna dia={dia} />
                      </td>
                      <td className="border-b p-2 align-top">
                        {dia.turno === null ? (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        ) : (
                          <TipoTurnoBadge tipo={dia.turno.tipo} />
                        )}
                      </td>
                      <td className="border-b p-2 align-top">
                        {dia.turno === null ? (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {formatearHorario(
                              dia.turno.horaInicio,
                              dia.turno.horaFin,
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
