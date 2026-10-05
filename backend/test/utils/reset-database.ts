// Reinicio de la base de pruebas entre suites.
//
// Borra el contenido de todas las tablas y vuelve a sembrar los datos base
// (roles, permisos, sucursales, variantes y el administrador), dejando cada
// suite en el mismo punto de partida.
//
// La lista de tablas se lee del propio PostgreSQL, no de una constante, para
// que anadir un modelo al schema no haga que este helper se quede corto y deje
// datos sueltos de una suite a otra.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { ejecutarSeed } from '../../src/database/seed';
import { exigirBaseDePruebas, urlBaseDePruebas } from './url-base-pruebas';
import {
  ADMIN_EMAIL_PRUEBAS,
  ADMIN_PASSWORD_PRUEBAS,
} from './constantes-pruebas';

/** Tablas de infraestructura de Prisma que NO se vacian. */
const TABLAS_PROTEGIDAS = new Set(['_prisma_migrations']);

export type ClientePrueba = PrismaClient;

/**
 * Crea un cliente de Prisma contra la base de pruebas.
 *
 * Aborta si la base no termina en "_test", antes de abrir la conexion.
 */
export function crearClientePrueba(): ClientePrueba {
  // `urlBaseDePruebas` ya aborta si la base no termina en "_test"; la segunda
  // comprobacion deja explicito que ningun cliente se construye sin ella.
  const connectionString = urlBaseDePruebas();
  exigirBaseDePruebas(connectionString);

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Nombres de las tablas de aplicacion, excluidas las de Prisma. */
async function listarTablas(prisma: ClientePrueba): Promise<string[]> {
  const filas = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
  );

  return filas.map((fila) => fila.table_name).filter((nombre) => !TABLAS_PROTEGIDAS.has(nombre));
}

/**
 * Vacia todas las tablas de aplicacion y ejecuta el seed.
 *
 * `TRUNCATE ... CASCADE` en una sola sentencia: es una operacion rapida y no
 * deja que una dependencia entre tablas provoque un fallo de clave foranea. Las
 * tablas que quedan vacias son las de la migracion de Prisma, para no perder el
 * historial de que esquema se aplico.
 */
export async function resetDatabase(prisma: ClientePrueba): Promise<void> {
  const tablas = await listarTablas(prisma);

  if (tablas.length === 0) {
    throw new Error(
      'La base de pruebas no tiene ninguna tabla. Ejecuta las migraciones antes ' +
        '(npm run test:e2e las aplica automaticamente; si las ejecutaste a mano, ' +
        'comprueba que prisma migrate deploy apuntando a la base de pruebas).',
    );
  }

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tablas.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );

  await ejecutarSeed(prisma, {
    email: ADMIN_EMAIL_PRUEBAS,
    password: ADMIN_PASSWORD_PRUEBAS,
  });
}

/** Cliente de Prisma compartido por la suite, creado una sola vez. */
let clienteCompartido: ClientePrueba | undefined;

export function clientePrueba(): ClientePrueba {
  clienteCompartido ??= crearClientePrueba();
  return clienteCompartido;
}

/** Cierra el cliente compartido. Se llama en el `afterAll` de cada suite. */
export async function cerrarClientePrueba(): Promise<void> {
  if (clienteCompartido) {
    await clienteCompartido.$disconnect();
    clienteCompartido = undefined;
  }
}