// Regla de dominio: PIN de marcacion de un empleado.
//
// El PIN lo genera el sistema: exactamente seis digitos, se muestra una sola vez
// en la respuesta de alta o de regeneracion, y en la base solo queda su hash
// bcrypt. Sin PIN, un empleado no puede marcar.
import { randomInt } from 'node:crypto';

/** Longitud fija del PIN. */
export const LONGITUD_PIN = 6;

/** Rango de generacion: de 000000 a 999999 inclusive. */
const LIMITE_EXCLUSIVO = 1_000_000;

/**
 * true si el valor es un PIN: una cadena de exactamente seis digitos.
 *
 * Los ceros a la izquierda cuentan, por eso se valida como texto y no como
 * numero.
 */
export function esPinValido(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d{6}$/u.test(valor);
}

/**
 * Genera un PIN de seis digitos.
 *
 * La fuente aleatoria se inyecta para poder probar el formato sin depender del
 * azar: en produccion es `crypto.randomInt`, que no repite patrones como los de
 * `Math.random`.
 */
export function generarPin(
  aleatorio: (minimo: number, maximo: number) => number = randomInt,
): string {
  return String(aleatorio(0, LIMITE_EXCLUSIVO)).padStart(LONGITUD_PIN, '0');
}
