// Calendario local del negocio para el modulo de asistencia.
//
// Se reutiliza el mismo calendario que usa personal (que a su vez reutiliza el de
// ventas) en vez de repetir la logica de "que dia es": dos implementaciones de la
// zona horaria del negocio podrian divergir y hacer que una marcacion cuente como
// de un dia distinto segun el modulo.
export {
  ZONA_HORARIA_NEGOCIO,
  esFechaLocal,
  fechaLocalDe,
  instanteDeFechaLocal,
  rangoDelDiaLocal,
} from '../../sales/domain/rules/fechas';

export { diaUtc } from '../../employees/domain/fechas';

/**
 * Dia `YYYY-MM-DD` de una columna `date` de Postgres.
 *
 * Las columnas `date` no llevan hora y Prisma las devuelve a medianoche UTC, asi
 * que los primeros diez caracteres del ISO son el dia guardado.
 */
export function fechaIsoDe(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/**
 * Dia de la semana ISO (1 = lunes ... 7 = domingo) de un dia local.
 *
 * `Date.getUTCDay()` devuelve 0 = domingo ... 6 = sabado; se reordena al
 * estandar ISO que usan los turnos (`dias_semana`).
 */
export function diaSemanaIso(fecha: string): number {
  const dia = new Date(`${fecha}T00:00:00.000Z`).getUTCDay();
  return dia === 0 ? 7 : dia;
}
