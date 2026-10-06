// Regla de dominio: nombres del catalogo de insumos.
//
// El nombre de un insumo es unico en toda la tabla, pero el indice unico de
// Postgres es exacto y sensible a mayusculas: "Cafe" y "cafe" pueden convivir
// y ambos se leen igual. Aqui se define la forma canonica con la que se compara
// lo que el usuario escribe contra lo que hay guardado.
import { BadRequestException } from '@nestjs/common';

/** Longitud minima del nombre, contando solo el texto util. */
export const NOMBRE_INSUMO_MINIMO = 2;

/** Longitud maxima. Es el `VARCHAR` que la base da por defecto al no declararlo. */
export const NOMBRE_INSUMO_MAXIMO = 100;

/**
 * Forma canonica de un nombre: sin espacios en los extremos, separaciones
 * internas reducidas a una sola y en minusculas.
 */
export function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/gu, ' ').toLowerCase();
}

/** true si los dos nombres se consideran el mismo. */
export function mismoNombre(a: string, b: string): boolean {
  return normalizarNombre(a) === normalizarNombre(b);
}

/**
 * Recorta el nombre tal y como se guarda: sin espacios en los extremos y con las
 * separaciones internas reducidas a una sola. Las mayusculas NO se tocan: el
 * nombre que escribe el usuario es el que queda, y la comparacion sin
 * mayusculas la hace `normalizarNombre`, no el dato almacenado.
 *
 * @throws BadRequestException (400) si se queda demasiado corto.
 */
export function validarNombreInsumo(nombre: string): string {
  const limpio = nombre.trim().replace(/\s+/gu, ' ');

  if (limpio.length < NOMBRE_INSUMO_MINIMO) {
    throw new BadRequestException(
      `El nombre debe tener al menos ${NOMBRE_INSUMO_MINIMO} caracteres`,
    );
  }

  if (limpio.length > NOMBRE_INSUMO_MAXIMO) {
    throw new BadRequestException(
      `El nombre no puede exceder ${NOMBRE_INSUMO_MAXIMO} caracteres`,
    );
  }

  return limpio;
}
