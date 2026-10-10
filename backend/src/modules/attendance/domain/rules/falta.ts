// Regla de dominio: cuando un dia es una falta.
//
// Una falta es un dia con asignacion VIGENTE de un turno FIJO cuyo `diasSemana`
// incluye ese dia, sin entrada efectiva y sin justificacion. Limitacion
// conocida y deliberada: los turnos VARIABLES no generan faltas, porque no se
// puede saber que dia le tocaba al empleado sin una programacion explicita.
import { diasSemanaDe } from '../../../shifts/domain/rules/dias-semana';
import { diaSemanaIso } from '../fechas';

export const TURNO_FIJO = 'fijo';
export const TURNO_VARIABLE = 'variable';

/** Turno asignado, reducido a lo que la regla necesita. */
export type TurnoDeAsignacion = {
  tipo: string;
  diasSemana: string | null;
};

/** true si el turno exige presencia en dias fijos de la semana. */
export function esTurnoFijo(tipo: string): boolean {
  return tipo === TURNO_FIJO;
}

/** true si el turno requiere presencia el dia local `fecha` (YYYY-MM-DD). */
export function turnoExigeDia(turno: TurnoDeAsignacion, fecha: string): boolean {
  if (!esTurnoFijo(turno.tipo)) {
    return false;
  }

  return diasSemanaDe(turno.diasSemana).includes(diaSemanaIso(fecha));
}

/**
 * true si el dia es una falta.
 *
 * @param turno turno vigente ese dia (o el candidato, si hay varias asignaciones).
 * @param fecha dia local `YYYY-MM-DD`.
 * @param tieneEntrada el empleado registrose una entrada efectiva ese dia.
 * @param tieneJustificacion hay una justificacion de falta ese dia.
 */
export function esFalta(datos: {
  turno: TurnoDeAsignacion;
  fecha: string;
  tieneEntrada: boolean;
  tieneJustificacion: boolean;
}): boolean {
  return (
    turnoExigeDia(datos.turno, datos.fecha) &&
    !datos.tieneEntrada &&
    !datos.tieneJustificacion
  );
}

/** true si la asignacion esta vigente el dia `fecha` (incluye el limite). */
export function asignacionVigenteElDia(asignacion: {
  fechaInicio: string;
  fechaFin: string | null;
  fecha: string;
}): boolean {
  return (
    asignacion.fecha >= asignacion.fechaInicio &&
    (asignacion.fechaFin === null || asignacion.fecha <= asignacion.fechaFin)
  );
}