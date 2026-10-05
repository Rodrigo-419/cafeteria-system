// Creacion de la aplicacion Nest para las pruebas end-to-end.
//
// Reune en un sitio la desviacion que la app de pruebas necesita respecto a
// `main.ts`, para que cada suite no tenga que recordarla:
//
//   1. El limite de intentos del throttler se sustituye por un almacenamiento
//      que nunca bloquea. Las pruebas hacen decenas de POST /auth/login y sin
//      esto la de 5 intentos/minuto del propio login las haria fallar entre
//      suites por motivos que no tienen que ver con lo que se prueba.
//   2. Se usa `configureApp`, el mismo que usa `main.ts`, para que el prefijo
//      global y el ValidationPipe sean los reales en vez de una copia.
//
// El entorno de pruebas (base de datos y secreto JWT) lo fija
// `test/entorno-pruebas.ts` mediante `setupFiles`, que corre antes de que se
// importe `AppModule`. Ver el comentario de ese archivo: si se hiciera aqui,
// las pruebas se ejecutarian contra la base de desarrollo.
import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getStorageToken, type ThrottlerStorage } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { exigirBaseDePruebas, urlBaseDePruebas } from './url-base-pruebas';

/**
 * Almacenamiento del throttler que nunca marca una peticion como bloqueada.
 *
 * Se sustituye el almacenamiento en lugar del guard para no tener que suplantar
 * `APP_GUARD`, que en `app.module.ts` esta registrado tres veces (jwt,
 * permisos y throttler) y no se puede sustituir de forma no ambigua.
 */
class AlmacenamientoSinLimites implements ThrottlerStorage {
  increment(): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    return Promise.resolve({
      totalHits: 0,
      timeToExpire: 0,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  }
}

/**
 * Compila la aplicacion y la deja lista para supertest.
 *
 * El entorno (base de pruebas y secreto JWT) ya lo fijo `entorno-pruebas.ts`
 * mediante `setupFiles`, antes de importar este modulo. Aqui solo queda
 * comprobar la invariante y montar la app.
 *
 * El servidor HTTP se levanta sin `listen`: supertest abre un puerto efimero
 * por peticion, que es lo que evita que las suites colisionen.
 */
export async function crearAppDePruebas(): Promise<INestApplication> {
  exigirBaseDePruebas(urlBaseDePruebas());

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(getStorageToken())
    .useClass(AlmacenamientoSinLimites)
    .compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app);

  await app.init();

  return app;
}