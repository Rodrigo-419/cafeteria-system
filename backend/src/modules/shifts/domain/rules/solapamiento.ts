// Regla de dominio: solapamiento de asignaciones del MISMO empleado.
//
// Dos asignaciones del mismo empleado chocan cuando sus rangos de fechas se
// solapan Y, ademas, sus turnos se pisan en el tiempo:
//
//   * los dos son fijos y comparten algun dia de la semana y sus franjas
//     horarias se cruzan, o
//   * alguno de los dos es variable (un turno variable puede caer en cualquier
//     momento, asi que choca con cualquier otro).
//
// El solapamiento se mide SIEMPRE entre asignaciones del mismo empleado. Varios
// empleados pueden compartir el mismo turno sin limite: no hay tope de personal
// por turno ni por cargo (el turno no tiene capacidad y el cargo es texto libre).

import { diasSeCruzan } from './dias-semana';
import { minutosDeHora } from './horario';

/** Horario de un turno tal y como lo necesitan estas reglas. */
export type HorarioTurno = {
  tipo: string;
  horaInicio: string | null;
  horaFin: string | null;
  diasSemana: string | null;
};

/** Rango de vigencia de una asignacion. */
export type RangoFechas = {
  fechaInicio: string;
  fechaFin: string | null;
};

export type AsignacionHorario = RangoFechas & { turno: HorarioTurno };

const FECHA_MAXIMA = '9999-12-31';

/**
 * true si dos rangos de fechas se solapan.
 *
 * Los extremos son inclusivos (una asignacion que empieza el dia en que otra
 * termina cuenta como solapada). `fechaFin` nula significa "sin fecha de fin" y
 * se trata como una fecha muy futura. La comparacion es de textos `YYYY-MM-DD`,
 * que ordenan igual que las fechas.
 */
export function rangosDeFechasSeCruzan(a: RangoFechas, b: RangoFechas): boolean {
  const finA = a.fechaFin ?? FECHA_MAXIMA;
  const finB = b.fechaFin ?? FECHA_MAXIMA;

  return a.fechaInicio <= finB && b.fechaInicio <= finA;
}

/** true si dos franjas horarias se pisan (se tocan en el borde NO cuentan). */
export function horasSeCruzan(
  aInicio: string,
  aFin: string,
  bInicio: string,
  bFin: string,
): boolean {
  return (
    minutosDeHora(aInicio) < minutosDeHora(bFin) &&
    minutosDeHora(bInicio) < minutosDeHora(aFin)
  );
}

/**
 * true si los horarios de dos turnos chocan.
 *
 * Un fijo sin franja no deberia existir (lo impide el alta), pero si llegara a
 * darse se trata como variable: bloquear de mas es mas seguro que dejar pasar un
 * solapamiento.
 */
export function horariosSeCruzan(a: HorarioTurno, b: HorarioTurno): boolean {
  if (a.tipo === 'variable' || b.tipo === 'variable') {
    return true;
  }

  const { horaInicio: aInicio, horaFin: aFin, diasSemana: aDias } = a;
  const { horaInicio: bInicio, horaFin: bFin, diasSemana: bDias } = b;

  if (aInicio === null || aFin === null || bInicio === null || bFin === null) {
    return true;
  }

  return diasSeCruzan(aDias, bDias) && horasSeCruzan(aInicio, aFin, bInicio, bFin);
}

/** true si dos asignaciones del mismo empleado se solapan. */
export function asignacionesSeSolapan(
  a: AsignacionHorario,
  b: AsignacionHorario,
): boolean {
  return rangosDeFechasSeCruzan(a, b) && horariosSeCruzan(a.turno, b.turno);
}

/** true si `nueva` se solapa con alguna de `existentes`. */
export function haySolapamiento(
  nueva: AsignacionHorario,
  existentes: readonly AsignacionHorario[],
): boolean {
  return existentes.some((existente) => asignacionesSeSolapan(nueva, existente));
}
