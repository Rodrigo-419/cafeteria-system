// Regla de dominio con la politica de contrasenas (longitud y complejidad).

/** Longitud minima en caracteres de una contrasena nueva. */
export const LONGITUD_MINIMA_PASSWORD = 12;

/**
 * Longitud maxima en BYTES de una contrasena nueva. bcrypt solo considera los
 * primeros 72 bytes: lo que exceda se ignora en silencio, asi que una
 * contrasena mas larga daria dos contrasenas distintas con el mismo hash.
 */
export const LONGITUD_MAXIMA_BYTES_PASSWORD = 72;

/**
 * Valida una contrasena NUEVA (por ejemplo al crear un usuario).
 * El login NO aplica esta regla: solo comprueba el hash guardado.
 *
 * @returns lista de problemas; vacia significa que la contrasena es valida.
 */
export function validarPassword(password: string): string[] {
  const problemas: string[] = [];

  if (password.length < LONGITUD_MINIMA_PASSWORD) {
    problemas.push(`debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres`);
  }

  const bytes = Buffer.byteLength(password, 'utf8');
  if (bytes > LONGITUD_MAXIMA_BYTES_PASSWORD) {
    problemas.push(
      `no puede superar ${LONGITUD_MAXIMA_BYTES_PASSWORD} bytes (tiene ${bytes}); ` +
        'bcrypt ignora los bytes sobrantes',
    );
  }

  return problemas;
}

/** true si `validarPassword` no devuelve problemas. */
export function esPasswordValida(password: string): boolean {
  return validarPassword(password).length === 0;
}