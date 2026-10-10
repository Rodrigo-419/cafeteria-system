// Calendario local del negocio para el modulo de personal.
//
// Se reutiliza el mismo calendario que usa ventas en vez de repetir la logica
// de "que dia es": dos implementaciones de la zona horaria del negocio podrian
// divergir y hacer que una operacion cuente como de un dia distinto segun el
// modulo. Si en el futuro un tercer modulo lo necesita, es candidato a mudarse
// a un lugar comun.
export {
  ZONA_HORARIA_NEGOCIO,
  esFechaLocal,
  fechaLocalDe,
} from '../../sales/domain/rules/fechas';

/**
 * Instante UTC de medianoche de un dia `YYYY-MM-DD`.
 *
 * Las columnas `date` de Postgres no llevan hora: se guardan y se comparan como
 * el dia a medianoche UTC, que es lo que produce esta conversion.
 */
export function diaUtc(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}
