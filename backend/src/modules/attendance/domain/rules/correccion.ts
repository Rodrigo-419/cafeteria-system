// Regla de dominio: validez de una correccion de asistencia.
//
// Una correccion reemplaza la hora del registro original. El `tipo` es opcional:
// si no viene, corrige el mismo tipo. Los dos usos legitimos son:
//
//   - Mismo tipo: mueve la hora de una entrada o de una salida.
//   - Entrada -> salida: CIERRE ADMINISTRATIVO de una entrada abierta (el
//     empleado olvido marcar la salida). El original sigue siendo una entrada;
//     la correccion añade la salida efectiva.
//
// No se admite `salida -> entrada`: seria convertir una salida en una entrada y
// dejaria el emparejamiento sin sentido. La regla es pura.
import { REGISTRO_ENTRADA, REGISTRO_SALIDA } from './registros-efectivos';

/** true si `tipoCorreccion` es un tipo valido para corregir la original. */
export function permiteCorreccion(
  tipoOriginal: string,
  tipoCorreccion: string,
): boolean {
  if (tipoCorreccion === tipoOriginal) {
    return true;
  }

  return (
    tipoOriginal === REGISTRO_ENTRADA && tipoCorreccion === REGISTRO_SALIDA
  );
}

/** true si la correccion cierra administrativamente una entrada abierta. */
export function esCierreAdministrativo(
  tipoOriginal: string,
  tipoCorreccion: string,
): boolean {
  return (
    tipoOriginal === REGISTRO_ENTRADA && tipoCorreccion === REGISTRO_SALIDA
  );
}

/** true si la fecha de la correccion es futura respecto de `ahora`. */
export function correccionFutura(fechaHora: Date, ahora: Date): boolean {
  return fechaHora.getTime() > ahora.getTime();
}

/** true si el cierre es estrictamente posterior a la entrada efectiva. */
export function cierrePosteriorAEntrada(
  entradaEfectiva: Date,
  fechaCierre: Date,
): boolean {
  return fechaCierre.getTime() > entradaEfectiva.getTime();
}
