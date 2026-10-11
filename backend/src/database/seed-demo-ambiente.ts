// Reglas puras de entorno del seed de DEMOSTRACION.
//
// Vive aparte de `seed-demo.ts` para poder probarse sin arrastrar el contexto de
// Nest ni el cliente de Prisma: estas funciones no importan nada de la
// aplicacion, solo la politica de contrasenas. No guardan ni registran el valor
// de la contrasena en ningun momento.
import {
  LONGITUD_MINIMA_PASSWORD,
  validarPassword,
} from '../modules/auth/domain/rules/password-policy';

/** Variable de entorno de la que sale la contrasena de los usuarios demo. */
export const VARIABLE_PASSWORD_DEMO = 'SEED_DEMO_PASSWORD';

/** true si el entorno indicado es produccion. */
export function esEntornoProduccion(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'production';
}

/**
 * Corta la ejecucion si el entorno es produccion.
 *
 * El seed de demostracion crea usuarios con una contrasena compartida y datos
 * ficticios; no debe poder tocar la base de produccion ni por accidente.
 */
export function asegurarEntornoDemo(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): void {
  if (esEntornoProduccion(nodeEnv)) {
    throw new Error(
      'El seed de demostracion no se ejecuta con NODE_ENV=production. ' +
        'Esta pensado solo para desarrollo local; usa una base que no sea la de produccion.',
    );
  }
}

/**
 * Lee y valida `SEED_DEMO_PASSWORD`.
 *
 * Falla sin mostrar nunca el valor: el mensaje solo nombra la variable y el
 * motivo. Reutiliza la misma politica de contrasenas que el alta de usuarios.
 */
export function leerPasswordDemo(
  env: Record<string, string | undefined>,
): string {
  const password = env[VARIABLE_PASSWORD_DEMO] ?? '';

  if (password === '') {
    throw new Error(
      `Falta ${VARIABLE_PASSWORD_DEMO} en el entorno. ` +
        `Definela en backend/.env (minimo ${LONGITUD_MINIMA_PASSWORD} caracteres; ` +
        'plantilla en backend/.env.example). Por seguridad no se muestra su valor.',
    );
  }

  const problemas = validarPassword(password);

  if (problemas.length > 0) {
    throw new Error(
      `${VARIABLE_PASSWORD_DEMO} no cumple la politica de seguridad: ` +
        `${problemas.join('; ')}. Por seguridad no se muestra su valor.`,
    );
  }

  return password;
}
