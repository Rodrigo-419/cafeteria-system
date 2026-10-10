// Calendario local del negocio para el modulo de turnos.
//
// Se reutiliza el mismo calendario que usa personal (y este, el de ventas) en
// vez de repetir la logica de "que dia es": dos implementaciones de la zona
// horaria del negocio podrian divergir y hacer que una operacion cuente como de
// un dia distinto segun el modulo.
export {
  ZONA_HORARIA_NEGOCIO,
  diaUtc,
  esFechaLocal,
  fechaLocalDe,
} from '../../employees/domain/fechas';

/**
 * Dia `YYYY-MM-DD` de una columna `date` de Postgres.
 *
 * Las columnas `date` no llevan hora y Prisma las devuelve a medianoche UTC,
 * asi que los primeros diez caracteres del ISO son el dia guardado.
 */
export function fechaIsoDe(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}
