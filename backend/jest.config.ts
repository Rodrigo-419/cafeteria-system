import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import ts from 'typescript';

// Path aliases (e.g. the ones added by `nest g library`) live in tsconfig.json,
// so they are read from there instead of being duplicated here.
const { config: tsconfig } = ts.readConfigFile(
  './tsconfig.json',
  ts.sys.readFile,
);
const paths = tsconfig?.compilerOptions?.paths ?? {};

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // Sin tope, Jest lanza un worker por CPU menos uno (11 en una maquina de 12).
  // Cada worker de ts-jest compila su propio TypeScript y se queda con bastante
  // memoria, asi que en paralelo agotan la RAM disponible y V8 aborta con un
  // fallo de asignacion ("Scavenge ... failure"). Se acotan los workers y se
  // reciclan los que se quedan ociosos por encima de 512 MB.
  maxWorkers: 4,
  workerIdleMemoryLimit: '512MB',
  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    'libs/**/*.(t|j)s',
    'apps/**/*.(t|j)s',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};

export default config;
