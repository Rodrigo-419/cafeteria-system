// Reintento acotado para la PRIMERA CONSULTA de lectura cuando la base acaba
// de despertar.
//
// Contexto: en un alojamiento serverless (Neon, Supabase, etc.) la base puede
// estar suspendida. La primera consulta de una peticion falla con un error de
// conexion ("server closed the connection", "can't reach database server",
// "timed out fetching a new connection from the pool") aunque el pool se
// reconecte solo en el siguiente intento.
//
// Este modulo reintenta SOLO esos errores de conexion y SOLO en consultas de
// LECTURA. Reintentar una escritura es peligroso: si la primera llego a
// aplicarse y luego fallo la confirmacion, repetirla duplicaria el efecto.
// Por eso no existe un helper de escritura y los dos metodos de lectura del
// repositorio de autenticacion son los que lo usan.
//
// Es puro y no toca Prisma ni la red: se prueba con errores simulados.

/** Codigos de error de Prisma que indican un problema de conexion. */
const CODIGOS_PRISMA_DE_CONEXION = new Set([
  'P1001', // No se pudo alcanzar el servidor de la base de datos.
  'P1002', // El servidor respondio pero la conexion agoto el tiempo.
  'P1008', // Las operaciones agotaron el tiempo.
  'P1017', // El servidor cerro la conexion.
  'P2024', // Se agoto el tiempo esperando una conexion del pool.
]);

/** Codigos de error de `pg`/Node que indican un problema de conexion. */
const CODIGOS_PG_DE_CONEXION = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNABORTED',
]);

/** Mensajes habituales de una conexion cerrada o terminada. */
const PATRONES_DE_CONEXION = [
  /connection terminated/i,
  /connection ended/i,
  /server closed the connection/i,
  /terminating connection/i,
  /connection error/i,
  /can't reach database server/i,
  /cannot use a pool after calling end/i,
  /pool is draining/i,
  /the client is closed/i,
  /connection was closed/i,
  /connection timed out/i,
  /timed out fetching a new connection/i,
  /write EPIPE/i,
];

interface ErrorConCodigo {
  code?: unknown;
  message?: unknown;
  cause?: unknown;
}

/**
 * `true` si el error es de conexion (base suspendida, socket cerrado, pool
 * agotado). Nunca lanza: devuelve `false` para cualquier otra cosa.
 */
export function esErrorDeConexion(error: unknown): boolean {
  if (error === null || typeof error !== 'object') {
    return false;
  }

  const candidato = error as ErrorConCodigo;

  if (
    typeof candidato.code === 'string' &&
    (CODIGOS_PRISMA_DE_CONEXION.has(candidato.code) ||
      CODIGOS_PG_DE_CONEXION.has(candidato.code))
  ) {
    return true;
  }

  if (
    typeof candidato.message === 'string' &&
    PATRONES_DE_CONEXION.some((patron) => patron.test(candidato.message as string))
  ) {
    return true;
  }

  // Prisma envuelve el error original en `cause` (p. ej. el error de `pg`).
  if (candidato.cause !== undefined && candidato.cause !== error) {
    return esErrorDeConexion(candidato.cause);
  }

  return false;
}

/** Opciones del reintento. */
export interface OpcionesReconexion {
  /** Intentos totales, incluido el primero. Por defecto 3. */
  intentos?: number;
  /** Espera fija entre intentos, en milisegundos. Por defecto 500. */
  retrasoMs?: number;
  /** Inyeccion de la espera; solo para pruebas. */
  dormir?: (ms: number) => Promise<void>;
  /** Se invoca antes de cada reintento (no del primer intento). */
  alReintentar?: (intento: number, error: unknown) => void;
}

const OPCIONES_DEFECTO = { intentos: 3, retrasoMs: 500 } as const;

/**
 * Ejecuta una consulta de LECTURA con un reintento acotado solo ante errores de
 * conexion.
 *
 * Garantias:
 *   - Solo reintenta si `esErrorDeConexion` es `true`.
 *   - No reintenta ningun otro error (validacion, restricciones, permisos...).
 *   - Es para LECTURAS: al no tener efecto, repetirlas no puede duplicar datos.
 *   - El numero de intentos es finito; si se agota, lanza el ultimo error.
 *
 * NO se debe usar para escrituras: una escritura que fallo por conexion pudo
 * haberse aplicado y repetirla duplicaria el efecto.
 */
export async function consultarConReconexion<T>(
  consulta: () => Promise<T>,
  opciones: OpcionesReconexion = {},
): Promise<T> {
  const intentos = Math.max(1, opciones.intentos ?? OPCIONES_DEFECTO.intentos);
  const retrasoMs = Math.max(0, opciones.retrasoMs ?? OPCIONES_DEFECTO.retrasoMs);
  const dormir =
    opciones.dormir ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  let ultimoError: unknown;

  for (let intento = 1; intento <= intentos; intento += 1) {
    try {
      return await consulta();
    } catch (error) {
      ultimoError = error;

      if (intento === intentos || !esErrorDeConexion(error)) {
        throw error;
      }

      opciones.alReintentar?.(intento, error);
      await dormir(retrasoMs);
    }
  }

  throw ultimoError;
}
