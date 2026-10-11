// Regla de dominio del identificador de acceso: el nombre de usuario.
//
// El nombre de usuario reemplaza al correo electronico como identificador
// unico. La normalizacion (recortar y pasar a minusculas) se aplica SIEMPRE
// antes de validar y antes de comparar, para que dos valores que solo difieren
// en mayusculas o en espacios sobrantes se consideren el mismo.

/** Longitud minima en caracteres de un nombre de usuario. */
export const LONGITUD_MINIMA_NOMBRE_USUARIO = 3;

/** Longitud maxima en caracteres de un nombre de usuario. */
export const LONGITUD_MAXIMA_NOMBRE_USUARIO = 30;

/**
 * Patron de un nombre de usuario YA normalizado: empieza por letra o digito y
 * le siguen de 2 a 29 caracteres de letras minusculas, digitos, punto, guion o
 * guion bajo. En total, entre 3 y 30 caracteres.
 */
export const PATRON_NOMBRE_USUARIO = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/** Recorta los espacios de los extremos y pasa a minusculas. */
export function normalizarNombreUsuario(nombreUsuario: string): string {
  return nombreUsuario.trim().toLowerCase();
}

/**
 * Valida un nombre de usuario. Normaliza primero, de modo que un valor con
 * mayusculas o espacios sobrantes que, ya normalizado, cumpla el patron, es
 * valido.
 *
 * @returns lista de problemas; vacia significa que el nombre de usuario es valido.
 */
export function validarNombreUsuario(nombreUsuario: string): string[] {
  const normalizado = normalizarNombreUsuario(nombreUsuario);
  const problemas: string[] = [];

  if (
    normalizado.length < LONGITUD_MINIMA_NOMBRE_USUARIO ||
    normalizado.length > LONGITUD_MAXIMA_NOMBRE_USUARIO
  ) {
    problemas.push(
      `debe tener entre ${LONGITUD_MINIMA_NOMBRE_USUARIO} y ${LONGITUD_MAXIMA_NOMBRE_USUARIO} caracteres`,
    );
  } else if (!PATRON_NOMBRE_USUARIO.test(normalizado)) {
    problemas.push(
      'solo admite letras minusculas, digitos, punto, guion y guion bajo, y debe empezar por letra o digito',
    );
  }

  return problemas;
}

/** true si `validarNombreUsuario` no devuelve problemas. */
export function esNombreUsuarioValido(nombreUsuario: string): boolean {
  return validarNombreUsuario(nombreUsuario).length === 0;
}
