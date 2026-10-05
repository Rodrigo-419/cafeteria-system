// Entorno de las pruebas end-to-end.
//
// Se carga con `setupFiles`, que Jest ejecuta ANTES de importar el archivo de
// prueba. Esto es imprescindible y no un detalle de estilo: `app.module.ts`
// llama a `ConfigModule.forRoot(...)` en el momento de ser importado, es decir
// al cargar el spec, mucho antes de cualquier `beforeAll`. Si el valor de
// DATABASE_URL se asignara despues, el ConfigService ya habria cacheado la
// base de DESARROLLO y las pruebas se ejecutarian contra ella.
//
// Ademas, si el nombre de la base no termina en "_test", se aborta aqui antes
// de que se cargue un solo modulo de la aplicacion.
import { exigirBaseDePruebas, urlBaseDePruebas } from './utils/url-base-pruebas';
import { JWT_SECRET_PRUEBAS } from './utils/constantes-pruebas';

const connectionString = urlBaseDePruebas();

// Aborta aqui si la base no es de pruebas. Es la primera linea de defensa; el
// cliente de Prisma y el setup global vuelven a comprobarlo.
exigirBaseDePruebas(connectionString);

process.env.DATABASE_URL = connectionString;
process.env.JWT_SECRET = JWT_SECRET_PRUEBAS;
process.env.NODE_ENV = 'test';

// El administrador de las pruebas lo crea el seed contra la base de pruebas, no
// el .env de desarrollo. Se borran para que nada dependa de el por accidente.
delete process.env.SEED_ADMIN_EMAIL;
delete process.env.SEED_ADMIN_PASSWORD;