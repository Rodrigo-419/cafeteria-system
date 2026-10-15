// Etiquetas, formato y reglas de presentación del módulo de turnos.
//
// Las validaciones replican (sin sustituir) las del backend: el servidor es la
// autoridad y responde 400/409 con su propio mensaje. Los días usan el número
// ISO (1 = lunes ... 7 = domingo), que el contrato guarda como "1,2,3" ordenado
// y sin repetidos; el diálogo nunca produce otro formato.
import { esFechaLocalValida, formatearDiaLocal } from '@/lib/format/dates'
import type { TonoStatusPill } from '@/components/shared/StatusPill'
import type { AsignacionApi, TipoTurno, TurnoApi } from '@/types/api'

// ------------------------------------------------------------------- tipos

export const TIPOS_TURNO: readonly TipoTurno[] = ['fijo', 'variable']

export const ETIQUETA_TIPO_TURNO: Record<TipoTurno, string> = {
  fijo: 'Fijo',
  variable: 'Variable',
}

/** Color semántico de cada tipo: el fijo es la base, el variable un refuerzo. */
export const TONO_TIPO_TURNO: Record<TipoTurno, TonoStatusPill> = {
  fijo: 'info',
  variable: 'warning',
}

// -------------------------------------------------------------------- días

export interface DiaSemana {
  /** Número ISO: 1 = lunes ... 7 = domingo. */
  numero: number
  corto: string
  largo: string
}

export const DIAS_SEMANA: readonly DiaSemana[] = [
  { numero: 1, corto: 'Lun', largo: 'Lunes' },
  { numero: 2, corto: 'Mar', largo: 'Martes' },
  { numero: 3, corto: 'Mié', largo: 'Miércoles' },
  { numero: 4, corto: 'Jue', largo: 'Jueves' },
  { numero: 5, corto: 'Vie', largo: 'Viernes' },
  { numero: 6, corto: 'Sáb', largo: 'Sábado' },
  { numero: 7, corto: 'Dom', largo: 'Domingo' },
]

/** Números de un `diasSemana` del contrato; vacío si no hay texto. */
export function diasDeTexto(diasSemana: string | null): number[] {
  if (diasSemana === null || diasSemana.trim() === '') return []
  return diasSemana
    .split(',')
    .map((parte) => Number(parte.trim()))
    .filter((dia) => Number.isInteger(dia))
}

/** Texto canónico "1,2,3" a partir de días seleccionados (ordenados). */
export function textoDeDias(dias: readonly number[]): string {
  return [...dias].sort((a, b) => a - b).join(',')
}

/** "Lun, Mar, Vie" o un texto de relleno si el turno no tiene días. */
export function formatearDias(diasSemana: string | null): string {
  const dias = diasDeTexto(diasSemana)
  if (dias.length === 0) return 'Sin días definidos'
  return dias
    .map((numero) => DIAS_SEMANA.find((dia) => dia.numero === numero)?.corto)
    .filter((corto): corto is string => corto !== undefined)
    .join(', ')
}

/** "07:30 – 16:00" o "Sin horario" si el turno no tiene franja. */
export function formatearHorario(
  horaInicio: string | null,
  horaFin: string | null,
): string {
  if (!horaInicio || !horaFin) return 'Sin horario'
  return `${horaInicio} – ${horaFin}`
}

/** Resumen de un turno para listados: horario y días. */
export function resumenTurno(turno: TurnoApi): string {
  const horario = formatearHorario(turno.horaInicio, turno.horaFin)
  return turno.tipo === 'fijo' ? horario : `${horario} · variable`
}

// -------------------------------------------------------------- validación

const PATRON_HORA = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Problema de la franja horaria, o `null`. Un turno fijo necesita las dos
 * horas; uno variable puede no tenerlas, pero si trae una debe traer la otra.
 * No se admiten turnos que crucen la medianoche (la hora de fin debe ser mayor).
 */
export function mensajeHoras(
  tipo: TipoTurno,
  horaInicio: string,
  horaFin: string,
): string | null {
  const tieneInicio = horaInicio !== ''
  const tieneFin = horaFin !== ''

  if (tipo === 'fijo' && (!tieneInicio || !tieneFin)) {
    return 'Un turno fijo necesita la hora de inicio y la de fin.'
  }
  if (!tieneInicio && !tieneFin) return null
  if (tieneInicio !== tieneFin) {
    return 'Un turno variable debe llevar las dos horas o ninguna.'
  }
  if (!PATRON_HORA.test(horaInicio) || !PATRON_HORA.test(horaFin)) {
    return 'Las horas deben tener el formato HH:mm.'
  }
  if (horaFin <= horaInicio) {
    return 'La hora de fin debe ser posterior a la de inicio.'
  }
  return null
}

/** Problema de los días, o `null`. Un turno fijo debe indicar al menos uno. */
export function mensajeDias(
  tipo: TipoTurno,
  dias: readonly number[],
): string | null {
  if (tipo === 'fijo' && dias.length === 0) {
    return 'Un turno fijo debe indicar los días de la semana.'
  }
  return null
}

// --------------------------------------------------- fechas de asignación

/** Mensaje de la fecha de inicio de una asignación (obligatoria), o `null`. */
export function mensajeFechaInicio(valor: string): string | null {
  if (valor === '') return 'La fecha de inicio es obligatoria.'
  if (!esFechaLocalValida(valor)) return 'La fecha de inicio debe ser un día válido.'
  return null
}

/**
 * La fecha de inicio no puede ser anterior a la contratación del empleado.
 * `fechaContratacion` llega como instante ISO.
 */
export function mensajeFechaInicioContratacion(
  fechaContratacion: string,
  valor: string,
): string | null {
  const problema = mensajeFechaInicio(valor)
  if (problema) return problema
  if (valor < fechaContratacion.slice(0, 10)) {
    return 'La fecha de inicio no puede ser anterior a la contratación del empleado.'
  }
  return null
}

/** Mensaje de la fecha de fin opcional (al crear), o `null`. */
export function mensajeFechaFin(desde: string, valor: string): string | null {
  if (valor === '') return null
  if (!esFechaLocalValida(valor)) return 'La fecha de fin debe ser un día válido.'
  if (desde !== '' && valor < desde) {
    return 'La fecha de fin no puede ser anterior a la de inicio.'
  }
  return null
}

/**
 * Mensaje de la fecha de retiro (cierra la vigencia). No puede ser anterior al
 * inicio de la asignación ni a hoy en el calendario del negocio (`hoy` llega
 * como día "AAAA-MM-DD" de America/Lima).
 */
export function mensajeFechaRetiro(
  inicio: string,
  hoy: string,
  valor: string,
): string | null {
  if (valor === '') return 'La fecha de fin es obligatoria.'
  if (!esFechaLocalValida(valor)) return 'La fecha de fin debe ser un día válido.'
  if (valor < inicio.slice(0, 10)) {
    return 'La fecha de fin no puede ser anterior a la de inicio.'
  }
  if (valor < hoy) {
    return 'La fecha de fin no puede ser anterior a hoy.'
  }
  return null
}

// ------------------------------------------------------------- asignación

export type EstadoAsignacion = 'programada' | 'vigente' | 'finalizada'

/** Vigencia de una asignación: "14 abr 2026 – 20 abr 2026" o "Desde …". */
export function formatearVigencia(
  fechaInicio: string,
  fechaFin: string | null,
): string {
  const inicio = formatearDiaLocal(fechaInicio)
  if (fechaFin === null) return `Desde ${inicio}`
  return `${inicio} – ${formatearDiaLocal(fechaFin)}`
}

export const ETIQUETA_ESTADO_ASIGNACION: Record<EstadoAsignacion, string> = {
  programada: 'Programada',
  vigente: 'Vigente',
  finalizada: 'Finalizada',
}

export const TONO_ESTADO_ASIGNACION: Record<EstadoAsignacion, TonoStatusPill> = {
  programada: 'info',
  vigente: 'success',
  finalizada: 'neutral',
}

/** Estado de una asignación respecto a un día de negocio "AAAA-MM-DD". */
export function estadoAsignacion(
  asignacion: Pick<AsignacionApi, 'fechaInicio' | 'fechaFin'>,
  hoy: string,
): EstadoAsignacion {
  const inicio = asignacion.fechaInicio.slice(0, 10)
  const fin = asignacion.fechaFin?.slice(0, 10) ?? null
  if (inicio > hoy) return 'programada'
  if (fin !== null && fin < hoy) return 'finalizada'
  return 'vigente'
}
