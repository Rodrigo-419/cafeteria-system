// Ajuste global de las pruebas end-to-end.
//
// Se ejecuta UNA vez, antes que cualquier suite, y es lo unico que aplica
// migraciones. Va aparte del `beforeAll` de cada suite porque `migrate deploy`
// es una operacion de schema, no de datos: repetirla por suite solo haria la
// ejecucion mas lenta.
//
// La migracion se aplica contra la base de pruebas. `jest-e2e.json` ejecuta el
// binario de Prisma como proceso hijo, asi que no hereda el `process.env` de
// Jest: la URL se le pasa por el entorno del propio proceso.
//
// Si el nombre de la base no termina en "_test", esto aborta y las pruebas no
// llegan a ejecutarse.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  NOMBRE_BASE_PRUEBAS,
  exigirBaseDePruebas,
  nombreBaseDeDatos,
  urlBaseDePruebas,
} from './utils/url-base-pruebas';

/**
 * Ruta al CLI de Prisma.
 *
 * Se invoca con el mismo Node del proceso, no con `npx`, por dos motivos: en
 * Windows `npx` es un script `.cmd` que `execFileSync` rechaza sin shell, y
 * `shell: true` abriria una superficie de inyeccion de comandos innecesaria.
 */
function cliDePrisma(): string {
  return require.resolve('prisma/build/index.js');
}

/**
 * Ejecuta `prisma migrate deploy` contra la base de pruebas.
 *
 * `migrate deploy` y no `db push`: aplica las migraciones que hay en el
 * repositorio y no genera ninguna nueva, de modo que las pruebas no pueden
 * inventarse un schema distinto al que se despliega.
 */
function aplicarMigraciones(): void {
  const backendDir = resolve(__dirname, '..');
  const connectionString = urlBaseDePruebas();

  exigirBaseDePruebas(connectionString);

  // Aviso de una linea con el nombre de la base. La URL completa no se imprime.
  console.log(`[e2e] Aplicando migraciones en la base "${nombreBaseDeDatos(connectionString)}"`);

  try {
    execFileSync(process.execPath, [cliDePrisma(), 'migrate', 'deploy'], {
      cwd: backendDir,
      env: {
        ...process.env,
        DATABASE_URL: connectionString,
        NODE_ENV: 'test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true,
    });
  } catch (error) {
    const detalle = error as { stderr?: string; stdout?: string; message?: string };
    // stderr de Prisma puede incluir la URL; se filtra por si acaso.
    const salida = `${detalle.stdout ?? ''}${detalle.stderr ?? ''}`
      .split(connectionString)
      .join('[DATABASE_URL redactada]');

    throw new Error(
      `No se pudieron aplicar las migraciones en la base "${NOMBRE_BASE_PRUEBAS}".\n` +
        'Comprueba que Docker esta levantado y que el contenedor cafeteria-db responde.\n' +
        `Detalle: ${salida.trim() || detalle.message || 'sin detalle'}`,
    );
  }
}

export default async function globalSetup(): Promise<void> {
  aplicarMigraciones();
}