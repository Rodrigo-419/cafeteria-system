// Generador de contraseñas temporales.
//
// Usa `crypto.getRandomValues` (Web Crypto) para obtener entropía real del
// navegador. El juego de caracteres evita los ambiguos (0/O, 1/l/I) y la
// longitud por defecto (20) supera con holgura el mínimo operativo de 16.
//
// La contraseña vive solo en el estado del diálogo que la muestra: no se envía
// a ninguna consulta, no se persiste en almacenamiento y se descarta al cerrar.

/** Longitud por defecto de las contraseñas generadas. */
export const LARGO_CONTRASENA_GENERADA = 20

const CARACTERES =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789!@#$%&*-_+.'

/** Genera una contraseña aleatoria de `longitud` caracteres (mínimo 16). */
export function generarPassword(longitud = LARGO_CONTRASENA_GENERADA): string {
  const seguro = Math.max(longitud, 16)
  const bytes = new Uint8Array(seguro)
  crypto.getRandomValues(bytes)
  let resultado = ''
  for (const byte of bytes) {
    resultado += CARACTERES[byte % CARACTERES.length]
  }
  return resultado
}