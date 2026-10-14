// Saneador del detalle de auditoria.
//
// El detalle puede llevar cualquier campo de negocio, pero JAMAS un secreto. La
// comprobacion es por clave EXACTA (normalizada a minusculas): nada de regex
// amplias como /pin/i, que marcarian claves legitimas como "mapping" o
// "shipping". Si aparece una clave prohibida se lanza un error; como el evento
// se escribe en la misma transaccion que la operacion, la operacion entera se
// revierte en vez de dejar un rastro con el secreto.
const CLAVES_PROHIBIDAS = new Set([
  'password',
  'contrasena',
  'contraseña',
  'hash',
  'pin',
  'pinhash',
  'passwordhash',
  'secret',
  'token',
]);

/**
 * Recorre el detalle y lanza si encuentra una clave prohibida.
 *
 * Devuelve una copia nueva: arrays y objetos se reconstruyen para que el valor
 * saneado no comparta referencias con el original. Los tipos que no son objetos
 * planos (Date, primitivos) se devuelven tal cual.
 */
export function sanitizarDetalle(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map((elemento) => sanitizarDetalle(elemento));
  }

  if (esObjetoPlano(valor)) {
    const limpio: Record<string, unknown> = {};

    for (const [clave, contenido] of Object.entries(valor)) {
      if (CLAVES_PROHIBIDAS.has(clave.toLowerCase())) {
        throw new Error(
          `El detalle de auditoria no puede contener la clave "${clave}"`,
        );
      }

      limpio[clave] = sanitizarDetalle(contenido);
    }

    return limpio;
  }

  return valor;
}

/** true para objetos de datos (no arrays, no Date, no null). */
function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    !Array.isArray(valor) &&
    !(valor instanceof Date)
  );
}
