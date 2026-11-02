// Pestaña de faltas (G3).
//
// El backend calcula las faltas de un rango de días de negocio (America/Lima):
// exige `desde` y `hasta`, y solo considera turnos fijos. La pantalla parte del
// mes en curso y permite justificar cuando el usuario tiene `asistencia.corregir`.
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AccionesFila } from '@/components/shared/AccionesFila'
import { BarraListado } from '@/components/shared/BarraListado'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { useAuth } from '@/lib/auth/useAuth'
import { diaDeNegocioLima, formatearDiaLocal } from '@/lib/format/dates'
import { tienePermiso } from '@/lib/permissions/permissions'
import { mensajeDeError } from '@/features/attendance/mensajes'
import { etiquetaTurnoFalta } from '@/features/attendance/presentacion'
import { useFaltas } from '@/features/attendance/queries'
import { JustificarFaltaDialog } from './JustificarFaltaDialog'
import type { FaltaApi } from '@/types/api'

export function FaltasTab() {
  const { permisos } = useAuth()
  const puedeJustificar = tienePermiso(permisos, 'asistencia.corregir')

  const hoy = diaDeNegocioLima(new Date())
  const [desde, setDesde] = useState(`${hoy.slice(0, 7)}-01`)
  const [hasta, setHasta] = useState(hoy)
  const [justificar, setJustificar] = useState<FaltaApi | null>(null)

  const faltas = useFaltas({ desde, hasta })

  const columnas: Column<FaltaApi>[] = [
    {
      key: 'colaborador',
      header: 'Colaborador',
      cell: (falta) => <span className="font-medium">{falta.empleadoNombre}</span>,
    },
    {
      key: 'fecha',
      header: 'Fecha',
      cell: (falta) => (
        <span className="tabular-nums">{formatearDiaLocal(falta.fecha)}</span>
      ),
    },
    {
      key: 'turno',
      header: 'Turno',
      cell: (falta) => etiquetaTurnoFalta(falta.turno),
    },
    ...(puedeJustificar
      ? [
          {
            key: 'acciones',
            header: '',
            className: 'text-right',
            cell: (falta: FaltaApi) => (
              <AccionesFila
                principal={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setJustificar(falta)}
                  >
                    Justificar
                  </Button>
                }
              />
            ),
          } satisfies Column<FaltaApi>,
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <BarraListado
        filtrosVisibles={
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-40 space-y-2">
              <Label htmlFor="faltas-desde">Desde</Label>
              <Input
                id="faltas-desde"
                type="date"
                value={desde}
                onChange={(evento) => setDesde(evento.target.value)}
              />
            </div>
            <div className="w-40 space-y-2">
              <Label htmlFor="faltas-hasta">Hasta</Label>
              <Input
                id="faltas-hasta"
                type="date"
                value={hasta}
                onChange={(evento) => setHasta(evento.target.value)}
              />
            </div>
          </div>
        }
      />

      <DataTable
        columns={columnas}
        data={faltas.data?.items ?? []}
        isLoading={faltas.isLoading}
        error={faltas.error ? mensajeDeError(faltas.error, 'faltas') : null}
        onRetry={() => void faltas.refetch()}
        getRowId={(falta) => `${falta.empleadoId}-${falta.fecha}`}
        emptyTitle="Sin faltas"
        emptyDescription="No hay faltas registradas en el rango elegido."
      />

      {justificar && (
        <JustificarFaltaDialog
          falta={justificar}
          onClose={() => setJustificar(null)}
        />
      )}
    </div>
  )
}
