// Reglas puras de proteccion del destino del seed.
//
// Los comandos `npm run db:seed` y `npm run db:seed:demo` ESCRIBEN datos (crean
// roles, permisos, sucursales y usuarios). Antes de hacerlo, y sobre todo si la
// base de datos apunta a un host remoto (Neon, RDS, etc.), conviene mostrar el
// destino y exigir una confirmacion explicita. Asi un error al copiar la
// `DATABASE_URL` no termina sembrando datos en produccion.
//
// Este modulo es puro: no importa Nest, ni Prisma, ni `dotenv`, y no toca el
// sistema de archivos ni la red. Se puede probar de forma aislada.

/** Destino resuelto de una cadena de conexion de Postgres. */
export interface DestinoBase {
  /** Nombre de host (sin puerto). Vacio en el formato de socket unix. */
  host: string;
  /** Nombre de la base de datos. */
  nombreBase: string;
  /** `true` si el host es local (no requiere confirmacion explicita). */
  esLocal: boolean;
}

/** Hosts que se consideran locales. */
const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '::1', '']);

/** Valores afirmativos aceptados para la confirmacion explicita. */
const VALORES_AFIRMATIVOS = new Set([
  '1',
  'true',
  'si',
  'sí',
  'yes',
  'y',
  'on',
]);

/** Argumentos de linea de comandos que confirman un destino remoto. */
export const ARGUMENTOS_CONFIRMACION = [
  '--confirm',
  '--confirmar',
  '--yes',
  '-y',
];

/** Variable de entorno que confirma un destino remoto. */
export const VARIABLE_CONFIRMACION = 'SEED_CONFIRMAR_REMOTO';

/**
 * `true` si el host es local. Un host vacio corresponde al formato de socket
 * unix (`postgresql:///base?host=...`), que tambien es local.
 */
export function esHostLocal(host: string): boolean {
  return HOSTS_LOCALES.has(host.trim().toLowerCase());
}

/**
 * Analiza una cadena de conexion de Postgres y devuelve host y base.
 *
 * Lanza con un mensaje claro si la cadena no se puede analizar. Nunca incluye
 * el usuario ni la clave: solo host y base.
 */
export function analizarDestinoBase(connectionString: string): DestinoBase {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(
      'No se reconoce el formato de DATABASE_URL: no se pudo resolver el destino. ' +
        'Debe ser una URL de Postgres (ej. postgresql://usuario:clave@host:5432/basedatos).',
    );
  }

  const host = url.hostname.toLowerCase();
  const nombreBase =
    decodeURIComponent(url.pathname.replace(/^\//u, '')) || '(sin nombre)';

  return { host, nombreBase, esLocal: esHostLocal(host) };
}

/** Linea de una sola fila que resume el destino para la consola. */
export function describirDestino(destino: DestinoBase): string {
  const host = destino.host.length > 0 ? destino.host : '(socket unix local)';
  return `Destino del seed: base "${destino.nombreBase}" en ${host}.`;
}

/**
 * Mensaje que se muestra cuando falta la confirmacion en un destino remoto.
 * Incluye el host y la base para que la decision sea informada.
 */
export function mensajeConfirmacion(destino: DestinoBase): string {
  const host = destino.host.length > 0 ? destino.host : '(socket unix local)';
  return (
    `Vas a ejecutar el seed contra una base REMOTA:\n` +
    `  host: ${host}\n` +
    `  base: ${destino.nombreBase}\n` +
    'Este comando crea o modifica datos. Para continuar, confirma de forma ' +
    `explicita con el argumento "${ARGUMENTOS_CONFIRMACION[0]}" o con la ` +
    `variable de entorno ${VARIABLE_CONFIRMACION}=1.`
  );
}

/** `true` si el valor recibido es una confirmacion explicita. */
export function esConfirmacionExplicita(valor: string | undefined): boolean {
  if (valor === undefined) {
    return false;
  }
  return VALORES_AFIRMATIVOS.has(valor.trim().toLowerCase());
}

/**
 * Lee la confirmacion de la linea de comandos y del entorno.
 *
 * Basta con que aparezca un argumento de confirmacion o que
 * `SEED_CONFIRMAR_REMOTO` tenga un valor afirmativo.
 */
export function leerConfirmacion(
  argv: readonly string[],
  env: Record<string, string | undefined>,
): boolean {
  if (argv.some((argumento) => ARGUMENTOS_CONFIRMACION.includes(argumento))) {
    return true;
  }
  return esConfirmacionExplicita(env[VARIABLE_CONFIRMACION]);
}

/**
 * Exige una confirmacion explicita salvo que el destino sea local.
 *
 * Lanza `mensajeConfirmacion` si el destino es remoto y no hubo confirmacion.
 * No escribe nada por su cuenta: solo decide si se puede continuar.
 */
export function confirmarDestino(
  destino: DestinoBase,
  confirmado: boolean,
): void {
  if (destino.esLocal || confirmado) {
    return;
  }
  throw new Error(mensajeConfirmacion(destino));
}
