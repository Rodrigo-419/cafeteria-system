// Formato de turnos/asignaciones para la exportación (versiones backend).
//
// El frontend tiene sus propios helpers en `features/shifts/presentacion.ts`;
// como es un paquete independiente, aquí se replican las mismas reglas.

import type { AsignacionRespuesta } from '../../shifts/infrastructure/shifts.repository'

const DIAS: readonly { numero: number; corto: string }[] = [
  { numero: 1, corto: 'Lun' },
  { numero: 2, corto: 'Mar' },
  { numero: 3, corto: 'Mié' },
  { numero: 4, corto: 'Jue' },
  { numero: 5, corto: 'Vie' },
  { numero: 6, corto: 'Sáb' },
  { numero: 7, corto: 'Dom' },
]

/** "Lun, Mar, Vie" o "Sin días definidos". */
export function formatearDias(diasSemana: string | null): string {
  if (diasSemana === null || diasSemana.trim() === '') return 'Sin días definidos'
  return diasSemana
    .split(',')
    .map((p) => Number(p.trim()))
    .filter((n) => Number.isInteger(n))
    .map((n) => DIAS.find((d) => d.numero === n)?.corto)
    .filter((c): c is string => c !== undefined)
    .join(', ')
}

/** "07:30 – 16:00" o "Sin horario". */
export function formatearHorario(
  horaInicio: string | null,
  horaFin: string | null,
): string {
  if (!horaInicio || !horaFin) return 'Sin horario'
  return `${horaInicio} – ${horaFin}`
}

export type EstadoAsignacion = 'programada' | 'vigente' | 'finalizada'

/** Estado de una asignación respecto a un día "AAAA-MM-DD". */
export function estadoAsignacion(
  asignacion: Pick<AsignacionRespuesta, 'fechaInicio' | 'fechaFin'>,
  hoy: string,
): EstadoAsignacion {
  const inicio = asignacion.fechaInicio.toISOString().slice(0, 10)
  const fin = asignacion.fechaFin?.toISOString().slice(0, 10) ?? null
  if (inicio > hoy) return 'programada'
  if (fin !== null && fin < hoy) return 'finalizada'
  return 'vigente'
}
