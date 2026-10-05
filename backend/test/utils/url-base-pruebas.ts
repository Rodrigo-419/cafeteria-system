// Derivacion de la URL de la base de datos de pruebas.
//
// Reglas:
//   - La URL de pruebas se DERIVA de `DATABASE_URL` de backend/.env cambiando
//     solo el nombre de la base. No se escribe a mano para que no pueda
//     desincronizarse del servidor y el puerto reales.
//   - El valor NUNCA se imprime, ni en logs ni en errores.
//   - Si el nombre de la base no termina en `_test`, se aborta antes de
//     ejecutar nada. Es la red de seguridad que impide que una suite destruya
//     la base de desarrollo.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const NOMBRE_BASE_PRUEBAS = 'cafeteria_test';

/**
 * Lee `backend/.env` y devuelve el valor de una variable sin imprimirlo.
 *
 * Se usa `dotenv` para tener exactamente el mismo formato que usa la
 * aplicacion (comentarios, comillas, `export` opcional).
 */
function leerVariableDeEnv(nombre: string): string {
  const rutaEnv = resolve(__dirname, '..', '..', '.env');

  let contenido: string;
  try {
    contenido = readFileSync(rutaEnv, 'utf8');
  } catch {
    throw new Error(
      'No se encuentra backend/.env, necesario para derivar la base de pruebas. ' +
        'Copia la plantilla de backend/.env.example y ajusta los valores.',
    );
  }

  for (const lineaCruda of contenido.split(/\r?\n/u)) {
    const linea = lineaCruda.trim();
    if (linea.length === 0 || linea.startsWith('#')) {
      continue;
    }

    const separador = linea.indexOf('=');
    if (separador === -1) {
      continue;
    }

    const clave = linea.slice(0, separador).trim().replace(/^export\s+/u, '');
    if (clave !== nombre) {
      continue;
    }

    const valor = linea.slice(separador + 1).trim();
    // Se desenvuelven las comillas simples o dobles que manualmente usaria
    // alguien al escribir el .env a mano.
    const sinComillas =
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
        ? valor.slice(1, -1)
        : valor;

    if (sinComillas.length === 0) {
      throw new Error(`La variable ${nombre} de backend/.env esta vacia.`);
    }

    return sinComillas;
  }

  throw new Error(`La variable ${nombre} no esta definida en backend/.env.`);
}

/**
 * Nombre de la base de datos de una URL de Postgres.
 *
 * Se admiten tanto el formato `postgresql://user:pass@host:5432/db` como el
 * formato de socket unix `postgresql://user:pass@/db?host=...`.
 */
export function nombreBaseDeDatos(url: string): string {
  const sinConsulta = url.split('?')[0] ?? '';
  const ultimaBarra = sinConsulta.lastIndexOf('/');
  const nombre = sinConsulta.slice(ultimaBarra + 1);

  return decodeURIComponent(nombre);
}

/**
 * Cambia el nombre de la base en una URL de Postgres conservando el resto
 * (esquema, usuario, clave, host, puerto y parametros).
 */
function reemplazarBase(url: string, nombreNuevo: string): string {
  const separadorConsulta = url.indexOf('?');
  const base = separadorConsulta === -1 ? url : url.slice(0, separadorConsulta);
  const consulta = separadorConsulta === -1 ? '' : url.slice(separadorConsulta);

  const ultimaBarra = base.lastIndexOf('/');
  if (ultimaBarra === -1) {
    throw new Error(
      'No se reconoce el formato de DATABASE_URL de backend/.env: falta "/<base>".',
    );
  }

  return `${base.slice(0, ultimaBarra + 1)}${nombreNuevo}${consulta}`;
}

/**
 * Verifica que la base es de pruebas. Lanza si no lo es.
 *
 * Se llama en cuanto se deriva la URL y tambien despues, en la app de pruebas,
 * para que ningun camino llegue a abrir un pool contra la base equivocada.
 */
export function exigirBaseDePruebas(url: string): void {
  const nombre = nombreBaseDeDatos(url);

  if (!nombre.endsWith('_test')) {
    throw new Error(
      'Se aborta: la base de datos de las pruebas debe terminar en "_test" pero se ' +
        `resolvio "${nombre}". No se va a ejecutar nada para no tocar una base real.`,
    );
  }
}

/**
 * URL de la base de pruebas, derivada de `DATABASE_URL` de backend/.env.
 *
 * Lanza si el resultado no termina en `_test`.
 */
export function urlBaseDePruebas(): string {
  const urlDev = leerVariableDeEnv('DATABASE_URL');
  const urlTest = reemplazarBase(urlDev, NOMBRE_BASE_PRUEBAS);

  exigirBaseDePruebas(urlTest);

  return urlTest;
}

/**
 * Descripcion segura de la URL para logs: solo el nombre de la base.
 * El usuario, la clave, el host y el puerto no se exponen.
 */
export function nombreBaseDePruebas(): string {
  return nombreBaseDeDatos(urlBaseDePruebas());
}